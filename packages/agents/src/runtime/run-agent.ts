import { dbForOrg, RunStatus, Prisma } from "@axona/db";
import { AnthropicModelClient, type ModelClient } from "./model-client";
import { TraceCollector } from "./trace";
import { runLoop } from "./runtime";
import type { RunResult } from "./types";
import { buildAgentDef } from "../tools";

/**
 * Loads the Agent (tenant-scoped), runs the loop, and persists an AgentRun for
 * every run — success, failure, or proposal. The model used is recorded on the
 * trace (correlate lines).
 */
export async function runAgent(
  agentId: string,
  input: string,
  opts: { orgId: string; userId: string; model?: ModelClient },
): Promise<RunResult> {
  const db = dbForOrg(opts.orgId);
  const agent = await db.agent.findFirst({ where: { id: agentId } });
  if (!agent) throw new Error("agent not found in org");

  const def = buildAgentDef(agent);
  const trace = new TraceCollector();
  const ctx = { orgId: opts.orgId, userId: opts.userId, agentId, db, trace };
  const model = opts.model ?? new AnthropicModelClient();

  let status: RunResult["status"] = "FAILED";
  let text = "";
  try {
    const r = await runLoop(def, input, ctx, model);
    text = r.text;
    status = r.status;
  } catch (e) {
    trace.push("error", (e as Error).message);
  }

  // AgentRun.status is the §3.2 RunStatus enum (RUNNING|SUCCEEDED|FAILED). Map
  // AWAITING_APPROVAL onto RUNNING for now and carry the real proposal state in
  // the trace — the approval state machine + richer status are RBAC.4/AUDIT.3.
  const persisted: RunStatus =
    status === "AWAITING_APPROVAL"
      ? RunStatus.RUNNING
      : status === "SUCCEEDED"
        ? RunStatus.SUCCEEDED
        : RunStatus.FAILED;

  const run = await db.agentRun.create({
    data: {
      agentId,
      input: { input },
      trace: trace.lines as unknown as Prisma.InputJsonValue,
      status: persisted,
    },
  });

  return { runId: run.id, text, trace: trace.lines, status };
}
