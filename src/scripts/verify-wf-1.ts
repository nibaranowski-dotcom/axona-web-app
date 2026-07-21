/**
 * Verify WF.1 — Workflow DAG model + BullMQ run engine (PRD §10). Pure-logic
 * checks always run; the engine checks are gated on DATABASE_URL (Redis is NOT
 * required — the executor runs in-process with FakeModelClient). Run:
 *   pnpm verify:wf-1
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { captureSeededState } from "./lib/self-clean";
import {
  createWorkflowRun,
  evalCondition,
  executeWorkflowRun,
  FakeModelClient,
  runWorkflow,
  safeParseGraph,
  type ModelResponse,
} from "@axona/agents";

let passed = 0;
let failed = 0;
const check = async (
  label: string,
  fn: () => boolean | Promise<boolean>,
): Promise<void> => {
  try {
    const ok = await fn();
    console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
    ok ? passed++ : failed++;
  } catch (e) {
    console.log(`  FAIL ${label} — ${(e as Error).message}`);
    failed++;
  }
};

const root = process.cwd();
const read = (p: string) =>
  existsSync(p) ? readFileSync(join(root, p), "utf8") : "";

// A deterministic offline model: end the turn, no tool calls.
const fake = () =>
  new FakeModelClient([
    {
      stopReason: "end_turn",
      text: "step complete",
      toolUses: [],
      model: "fake-model",
    } satisfies ModelResponse,
  ]);

// A well-formed graph (procurement-shaped): trigger → agent → decision → agent →
// guardrail; used for the pure Zod checks.
const goodGraph = {
  trigger: { id: "t", type: "trigger", event: "x.hit", next: "a1" },
  nodes: [
    {
      id: "a1",
      type: "agent",
      agentCode: "proc-01",
      action: "rank",
      next: "g1",
    },
    {
      id: "g1",
      type: "gate",
      kind: "decision",
      condition: { field: "value", op: "lt", value: 50000 },
      onTrue: "a2",
      onFalse: "out",
    },
    {
      id: "a2",
      type: "agent",
      agentCode: "proc-04",
      action: "draft PO",
      next: "gg",
    },
    {
      id: "gg",
      type: "gate",
      kind: "guardrail",
      onTrue: "out",
      onFalse: "out",
    },
    { id: "out", type: "output", label: "done" },
  ],
};

async function run(): Promise<void> {
  console.log("\nVerifying WF.1 — Workflow DAG model + BullMQ run engine\n");

  // --- static structure ---
  await check(
    "engine files exist (graph · executor · worker · routes · seed)",
    () => {
      return (
        existsSync(join(root, "packages/agents/src/workflow/graph.ts")) &&
        existsSync(join(root, "packages/agents/src/workflow/executor.ts")) &&
        existsSync(join(root, "apps/worker/src/index.ts")) &&
        existsSync(
          join(root, "apps/web/app/api/workflows/[id]/run/route.ts"),
        ) &&
        existsSync(
          join(root, "apps/web/app/api/workflows/[id]/runs/route.ts"),
        ) &&
        existsSync(
          join(root, "apps/web/app/api/workflow-runs/[runId]/route.ts"),
        ) &&
        existsSync(join(root, "packages/db/prisma/seed/workflows.ts"))
      );
    },
  );
  await check(
    "run endpoint: requireRole gate; enqueue org-scoped from session",
    () => {
      const r = read("apps/web/app/api/workflows/[id]/run/route.ts");
      return (
        /requireRole/.test(r) &&
        /enqueueWorkflowRun/.test(r) &&
        /user\.orgId/.test(r) &&
        !/VIEWER/.test(r.split("CAN_RUN")[1] ?? r) // VIEWER not in the allow-list
      );
    },
  );
  await check(
    "executor: guardrail → AWAITING_APPROVAL + halt (propose-not-execute)",
    () => {
      const e = read("packages/agents/src/workflow/executor.ts");
      return (
        /guardrail/.test(e) &&
        /AWAITING_APPROVAL/.test(e) &&
        /no auto-execute/.test(e) &&
        /dbForOrg/.test(e)
      );
    },
  );

  // --- check 1: Zod validates good graph, rejects malformed ---
  await check(
    "Zod validates a good graph, rejects malformed (bad ref, no trigger)",
    () => {
      const good = safeParseGraph(goodGraph).success === true;
      const badRef = safeParseGraph({
        trigger: { id: "t", type: "trigger", event: "x", next: "nope" },
        nodes: [{ id: "out", type: "output", label: "done" }],
      }).success;
      const noTrigger = safeParseGraph({
        nodes: [{ id: "out", type: "output", label: "done" }],
      }).success;
      const badDecision = safeParseGraph({
        trigger: { id: "t", type: "trigger", event: "x", next: "g" },
        nodes: [{ id: "g", type: "gate", kind: "decision" }],
      }).success; // decision without condition/branches
      return good && !badRef && !noTrigger && !badDecision;
    },
  );

  // --- check 6 (pure): decision gate branches correctly ---
  await check(
    "decision gate: value lt 50000 → onTrue at 48k, onFalse at 60k",
    () => {
      const cond = { field: "value", op: "lt" as const, value: 50000 };
      return (
        evalCondition(cond, { value: 48000 }) === true &&
        evalCondition(cond, { value: 60000 }) === false &&
        evalCondition(
          { field: "tier", op: "in", value: ["A", "B"] },
          { tier: "B" },
        ) === true
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP engine/db checks — DATABASE_URL not set");
  } else {
    const { prisma, dbForOrg } = await import("@axona/db");
    // HOUSE.1 — self-clean residue (runs/POs/audit) so verify:all is idempotent.
    const _guard = await captureSeededState(prisma, [
      "AuditLog",
      "PurchaseOrder",
      "WorkflowRun",
      "AgentRun",
    ]);
    const org = await prisma.org.findFirst({
      where: { name: "Axona" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const orgId = org.id;
      const db = dbForOrg(orgId);
      const findWf = (name: string) =>
        db.workflow.findFirst({ where: { name } });

      // MIGRATE.1: snapshot the seeded runs so we can self-clean — the checks
      // below enqueue real runs on the seeded workflows, which would otherwise
      // leave the procurement workflow's LATEST run non-parked for verify:all
      // (flagged on WFL.1/WFL.2). Everything not in this set is deleted on exit,
      // restoring the seeded state (incl. the parked AWAITING_APPROVAL run).
      const seededRunIds = new Set(
        (
          await prisma.workflowRun.findMany({
            where: { orgId },
            select: { id: true },
          })
        ).map((r) => r.id),
      );

      // --- check 2: end-to-end SUCCEEDED with a non-empty TraceLine[] ---
      await check(
        "executor runs a seeded workflow → SUCCEEDED, trace non-empty",
        async () => {
          const wf = await findWf("NCR-118 → ECO-318");
          if (!wf) return false;
          const { runId, status } = await executeWorkflowRun(
            { workflowId: wf.id, orgId },
            { model: fake() },
          );
          const run = await db.workflowRun.findFirst({ where: { id: runId } });
          const trace = (run?.trace as unknown[]) ?? [];
          return (
            status === "SUCCEEDED" &&
            run?.status === "SUCCEEDED" &&
            !!run?.endedAt &&
            trace.length > 0 &&
            trace.every(
              (l) =>
                !!l &&
                typeof (l as { kind?: unknown }).kind === "string" &&
                typeof (l as { ts?: unknown }).ts === "string",
            )
          );
        },
      );

      // --- check 3: procurement parks AWAITING_APPROVAL, no PO written ---
      await check(
        "procurement run parks AWAITING_APPROVAL; no PO auto-placed",
        async () => {
          const wf = await findWf("Procurement reorder");
          if (!wf) return false;
          const poBefore = await db.purchaseOrder.count();
          const { runId, status } = await executeWorkflowRun(
            { workflowId: wf.id, orgId, triggerPayload: { value: 48000 } },
            { model: fake() },
          );
          const poAfter = await db.purchaseOrder.count();
          const run = await db.workflowRun.findFirst({ where: { id: runId } });
          const trace = (run?.trace as { kind: string }[]) ?? [];
          return (
            status === "AWAITING_APPROVAL" &&
            run?.status === "AWAITING_APPROVAL" &&
            poAfter === poBefore && // guardrail never auto-placed a PO
            trace.some((l) => l.kind === "proposal")
          );
        },
      );

      // --- check 6 (live): the decision onFalse branch reaches a SUCCEEDED output ---
      await check(
        "decision onFalse (value 60k) → escalate output → SUCCEEDED",
        async () => {
          const wf = await findWf("Procurement reorder");
          if (!wf) return false;
          const { status } = await executeWorkflowRun(
            { workflowId: wf.id, orgId, triggerPayload: { value: 60000 } },
            { model: fake() },
          );
          return status === "SUCCEEDED"; // onFalse → "escalate" output node
        },
      );

      // --- check 4: forced error → FAILED with partial trace persisted ---
      await check(
        "forced error (missing agent) → FAILED, partial trace persisted",
        async () => {
          const bad = await db.workflow.create({
            data: {
              orgId,
              moduleKey: "procurement",
              name: "__wf1_verify_forced_error",
              description: "temp",
              status: "DRAFT",
              trigger: { id: "t", type: "trigger", event: "x", next: "a1" },
              steps: {
                trigger: { id: "t", type: "trigger", event: "x", next: "a1" },
                nodes: [
                  {
                    id: "a1",
                    type: "agent",
                    agentCode: "nope-99",
                    action: "does not exist",
                    next: "out",
                  },
                  { id: "out", type: "output", label: "done" },
                ],
              },
            },
          });
          const { runId, status } = await executeWorkflowRun(
            { workflowId: bad.id, orgId },
            { model: fake() },
          );
          const run = await db.workflowRun.findFirst({ where: { id: runId } });
          const trace = (run?.trace as { kind: string }[]) ?? [];
          const ok =
            status === "FAILED" &&
            run?.status === "FAILED" &&
            trace.length > 0 &&
            trace.some((l) => l.kind === "error");
          // cleanup temp fixture
          await db.workflowRun.deleteMany({ where: { workflowId: bad.id } });
          await db.workflow.deleteMany({ where: { id: bad.id } });
          return ok;
        },
      );

      // --- check 5: org scoping — org A's run is invisible to another org ---
      await check(
        "org scoping: a run created for org A is not readable via org B",
        async () => {
          const wf = await findWf("Predictive maintenance → dispatch");
          if (!wf) return false;
          const runId = await createWorkflowRun({ workflowId: wf.id, orgId });
          await runWorkflow(
            { workflowId: wf.id, orgId, runId },
            { model: fake() },
          );
          const mine = await db.workflowRun.findFirst({ where: { id: runId } });
          const theirs = await dbForOrg(
            "org_does_not_exist",
          ).workflowRun.findFirst({
            where: { id: runId },
          });
          return !!mine && theirs === null;
        },
      );

      // --- seeded fixtures present (WFL.1/WFL.2 render populated) ---
      await check(
        "seed: ≥3 workflows incl. a parked AWAITING_APPROVAL run",
        async () => {
          const parked = await db.workflowRun.findFirst({
            where: { status: "AWAITING_APPROVAL" },
          });
          const wfCount = await db.workflow.count();
          return wfCount >= 3 && !!parked;
        },
      );

      // MIGRATE.1 self-clean: delete every run this verify created, restoring the
      // seeded state so verify:all never pollutes the parked-run fixtures.
      await prisma.workflowRun.deleteMany({
        where: { orgId, id: { notIn: [...seededRunIds] } },
      });
      await check(
        "self-clean: seeded runs restored (procurement latest still parked)",
        async () => {
          const proc = await db.workflow.findFirst({
            where: { name: "Procurement reorder" },
          });
          const latest = await db.workflowRun.findFirst({
            where: { workflowId: proc!.id },
            orderBy: { startedAt: "desc" },
          });
          return latest?.status === "AWAITING_APPROVAL";
        },
      );
    }
    await _guard.restore();
    await prisma.$disconnect();
  }

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
