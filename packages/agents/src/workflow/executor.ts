import { dbForOrg, Prisma, RunStatus, writeAudit } from "@axona/db";
import { TraceCollector } from "../runtime/trace";
import { runAgent } from "../runtime/run-agent";
import {
  AnthropicModelClient,
  FakeModelClient,
  type ModelClient,
  type ModelResponse,
} from "../runtime/model-client";
import { evalCondition, parseGraph } from "./graph";

// WF.1 — the workflow DAG run engine (§6). Walks a validated WorkflowGraph from
// the trigger: agent nodes run via `runAgent` (re-using the ART.1/ART.2 runtime +
// the TraceLine shape — no second trace format), decision gates branch on the run
// context, and GUARDRAIL gates propose-not-execute: they emit an AWAITING_APPROVAL
// trace line and HALT the branch (money/safety/contract is never auto-executed —
// RBAC.4 resumes it). Every DB touch is org-scoped via dbForOrg(orgId).
//
// The engine is reusable: the enqueue API runs it in-process when there is no
// Redis; the apps/worker BullMQ consumer runs it off the "workflow-runs" queue.

export const WORKFLOW_QUEUE = "workflow-runs";
const MAX_NODES = 64; // cycle / runaway backstop (validation also rejects bad refs)

// Deterministic offline model: end the turn with no tool calls, so agent steps
// complete without side effects (the guardrail GATE is the one place that parks).
const END_TURN: ModelResponse = {
  stopReason: "end_turn",
  text: "step complete",
  toolUses: [],
  model: "fake-model",
};

export interface WorkflowRunJob {
  workflowId: string;
  orgId: string;
  userId?: string;
  triggerPayload?: Record<string, unknown>;
}
export type RunOutcome = "SUCCEEDED" | "FAILED" | "AWAITING_APPROVAL";

function pickModel(opts?: { model?: ModelClient }): ModelClient {
  if (opts?.model) return opts.model;
  return process.env.ANTHROPIC_API_KEY
    ? new AnthropicModelClient()
    : new FakeModelClient([END_TURN]);
}

/** Create the WorkflowRun (RUNNING) up front so the API can return a runId. */
export async function createWorkflowRun(job: WorkflowRunJob): Promise<string> {
  // dbForOrg also injects orgId at runtime (WorkflowRun is a tenant model); set
  // it explicitly too so the create type is satisfied — same value either way.
  const run = await dbForOrg(job.orgId).workflowRun.create({
    data: {
      workflowId: job.workflowId,
      orgId: job.orgId,
      status: RunStatus.RUNNING,
      trace: [] as unknown as Prisma.InputJsonValue,
    },
  });
  return run.id;
}

/**
 * Walk the DAG, persist the trace, and append ONE immutable audit row for the run
 * (AUDIT.1) — actor = the orchestrator agent, correlationId = runId, output = the
 * final outcome (incl. AWAITING_APPROVAL). The audit write never affects the run.
 */
export async function runWorkflow(
  job: WorkflowRunJob & { runId: string },
  opts?: { model?: ModelClient },
): Promise<RunOutcome> {
  const outcome = await walkWorkflow(job, opts);
  await writeAudit(dbForOrg(job.orgId), {
    orgId: job.orgId,
    actor: { type: "AGENT", id: null, label: "Workflow orchestrator" },
    action: "workflow.run",
    target: { type: "WorkflowRun", id: job.runId },
    summary: `workflow run → ${outcome}`,
    output: { status: outcome },
    correlationId: job.runId,
  });
  return outcome;
}

/** The DAG walk (the run body); runWorkflow wraps it with the audit write. */
async function walkWorkflow(
  job: WorkflowRunJob & { runId: string },
  opts?: { model?: ModelClient },
): Promise<RunOutcome> {
  const db = dbForOrg(job.orgId);
  const trace = new TraceCollector();
  const model = pickModel(opts);

  const flush = (status: RunStatus, terminal: boolean) =>
    db.workflowRun.updateMany({
      where: { id: job.runId },
      data: {
        status,
        trace: trace.lines as unknown as Prisma.InputJsonValue,
        ...(terminal ? { endedAt: new Date() } : {}),
      },
    });

  try {
    const wf = await db.workflow.findFirst({ where: { id: job.workflowId } });
    if (!wf) throw new Error("workflow not found in org");
    const graph = parseGraph(wf.steps); // throws on a malformed graph
    trace.push(
      "scan",
      `workflow "${wf.name}" · trigger ${graph.trigger.event}`,
    );
    const context: Record<string, unknown> = { ...(job.triggerPayload ?? {}) };

    let current = graph.trigger.next;
    let guard = 0;
    while (current && guard++ < MAX_NODES) {
      const node = graph.nodes.find((n) => n.id === current);
      if (!node) throw new Error(`unknown node "${current}"`);

      if (node.type === "agent") {
        const agent = await db.agent.findFirst({
          where: { code: node.agentCode },
        });
        if (!agent) throw new Error(`agent ${node.agentCode} not in org`);
        trace.push("draft", `${node.agentCode} · ${node.action}`);
        const r = await runAgent(agent.id, node.action, {
          orgId: job.orgId,
          userId: job.userId ?? "system",
          model,
          onTrace: (l) => {
            trace.lines.push(l);
          },
        });
        // A gated (money/safety/contract) tool proposed inside the step → park.
        if (r.status === "AWAITING_APPROVAL") {
          trace.push(
            "proposal",
            `proposed — AWAITING_APPROVAL (RBAC.4) · ${node.id}`,
          );
          await flush(RunStatus.AWAITING_APPROVAL, true);
          return "AWAITING_APPROVAL";
        }
        current = node.next;
      } else if (node.type === "gate") {
        if (node.kind === "guardrail") {
          // Propose-not-execute: never auto-place money/safety/contract actions.
          trace.push(
            "proposal",
            `guardrail ${node.id} — proposed — AWAITING_APPROVAL (RBAC.4); halting (no auto-execute)`,
          );
          await flush(RunStatus.AWAITING_APPROVAL, true);
          return "AWAITING_APPROVAL";
        }
        // decision gate — branch on the run context
        const outcome = node.condition
          ? evalCondition(node.condition, context)
          : false;
        trace.push(
          "policy-check",
          `gate ${node.id}: ${node.condition?.field} ${node.condition?.op} ${JSON.stringify(
            node.condition?.value,
          )} → ${outcome ? "onTrue" : "onFalse"}`,
        );
        current = outcome ? node.onTrue : node.onFalse;
      } else {
        // output node — terminal success
        trace.push("result", node.label);
        await flush(RunStatus.SUCCEEDED, true);
        return "SUCCEEDED";
      }
      await flush(RunStatus.RUNNING, false);
    }

    trace.push("result", "workflow complete");
    await flush(RunStatus.SUCCEEDED, true);
    return "SUCCEEDED";
  } catch (e) {
    // Persist the partial trace so a failed run is still renderable.
    trace.push("error", (e as Error).message);
    await flush(RunStatus.FAILED, true);
    return "FAILED";
  }
}

/** Create + run a workflow in-process (verify + the no-Redis API path). */
export async function executeWorkflowRun(
  job: WorkflowRunJob,
  opts?: { model?: ModelClient },
): Promise<{ runId: string; status: RunOutcome }> {
  const runId = await createWorkflowRun(job);
  const status = await runWorkflow({ ...job, runId }, opts);
  return { runId, status };
}

/**
 * RBAC.4 — resume a run parked at a guardrail gate after a human decision. Reuses
 * the executor's trace/persist primitives (does NOT fork the engine): preserves the
 * parked trace, appends the decision line, and moves the run to a terminal state —
 * APPROVE → SUCCEEDED, REJECT → FAILED. Org-scoped; idempotent (a non-parked run is
 * returned as-is). The AUDIT.1 entry is written by the approval primitive (decide).
 */
export async function resumeParkedRun(
  runId: string,
  orgId: string,
  decision: "APPROVE" | "REJECT",
  approverLabel: string,
): Promise<RunOutcome> {
  const db = dbForOrg(orgId);
  const run = await db.workflowRun.findFirst({ where: { id: runId } });
  if (!run) throw new Error("run not found in org");
  if (run.status !== RunStatus.AWAITING_APPROVAL) {
    return run.status as RunOutcome; // already resolved — no double-resume
  }

  const trace = new TraceCollector();
  const existing = Array.isArray(run.trace) ? (run.trace as unknown[]) : [];
  for (const line of existing)
    trace.lines.push(line as (typeof trace.lines)[number]);

  const terminal =
    decision === "APPROVE" ? RunStatus.SUCCEEDED : RunStatus.FAILED;
  if (decision === "APPROVE") {
    trace.push(
      "policy-check",
      `approved by ${approverLabel} — resuming past the guardrail gate`,
    );
    trace.push("result", "workflow complete (post-approval)");
  } else {
    trace.push(
      "policy-check",
      `rejected by ${approverLabel} — halted at the guardrail gate`,
    );
  }

  await db.workflowRun.updateMany({
    where: { id: runId },
    data: {
      status: terminal,
      trace: trace.lines as unknown as Prisma.InputJsonValue,
      endedAt: new Date(),
    },
  });
  return decision === "APPROVE" ? "SUCCEEDED" : "FAILED";
}
