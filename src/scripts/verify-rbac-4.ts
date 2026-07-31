/**
 * Verify RBAC.4 — approval state machine (PRD §8). Static checks always run; live
 * checks gated on DATABASE_URL. Self-cleaning: restores the PO's seeded status,
 * deletes its own runs, and removes the audit rows it created (admin disable-rule
 * path, like the seed). Run: pnpm verify:rbac-4
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { captureSeededState } from "./lib/self-clean";

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
  existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

async function run(): Promise<void> {
  console.log("\nVerifying RBAC.4 — approval state machine\n");

  // --- static: PO advance goes exclusively through the primitive (no ad-hoc) ---
  const poActions = read("apps/web/app/(shell)/procurement/actions.ts");
  await check(
    "PO advance/reject go through decide() — no ad-hoc mutation",
    () => {
      return (
        /decide\("po\.approve"/.test(poActions) &&
        /rejectPurchaseOrder/.test(poActions) &&
        !/purchaseOrder\.(update|updateMany)/.test(poActions) // no direct mutation
      );
    },
  );
  await check(
    "PoRow wires Approve + Reject; workflow detail wires decide",
    () => {
      const poRow = read("apps/web/components/procurement/PoRow.tsx");
      const wf = read("apps/web/components/workflows/WorkflowDetailView.tsx");
      return (
        /rejectPurchaseOrder/.test(poRow) &&
        /advancePurchaseOrder/.test(poRow) &&
        /workflow\.gate/.test(wf) &&
        /\/api\/approvals/.test(wf)
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP live checks — DATABASE_URL not set");
    finish();
    return;
  }

  const { prisma, dbForOrg } = await import("@axona/db");
  // HOUSE.1 — self-clean residue (runs/POs/audit) so verify:all is idempotent.
  const _guard = await captureSeededState(prisma, [
    "AuditLog",
    "PurchaseOrder",
    "WorkflowRun",
    "AgentRun",
    "MemoryItem", // VERIFY.3 — decide() writes a LOOP.1 outcome episode
  ]);
  const { executeWorkflowRun, FakeModelClient } = await import("@axona/agents");
  const { decide } = await import("../../apps/web/lib/approvals");
  const fake = () =>
    new FakeModelClient([
      {
        stopReason: "end_turn",
        text: "done",
        toolUses: [],
        model: "fake-model",
      },
    ]);

  const org = await prisma.org.findFirst({ where: { name: "Axona" } });
  const org2 = await prisma.org.findFirst({
    where: { name: "Isolation Test Co" },
  });
  if (!org || !org2) {
    console.log("  FAIL demo/second org missing (run pnpm db:seed)");
    failed++;
    finish();
    return;
  }
  const db = dbForOrg(org.id);
  const createdRunIds: string[] = [];

  const po = await db.purchaseOrder.findFirst({
    where: { status: "AWAITING_APPROVAL" },
    select: { id: true, status: true },
  });
  const opsUser = await prisma.user.findFirst({
    where: { orgId: org.id, role: "OPS" },
    select: { id: true, email: true, name: true },
  });

  const ops = {
    id: opsUser?.id ?? "ops",
    role: "OPS" as const,
    email: opsUser?.email ?? "ops@demo",
    name: opsUser?.name ?? "M. Osei",
    orgId: org.id,
  };
  const viewer = {
    id: "viewer-1",
    role: "VIEWER" as const,
    email: "v@demo",
    name: "V",
    orgId: org.id,
  };
  const resetPO = () =>
    po
      ? db.purchaseOrder.updateMany({
          where: { id: po.id },
          data: { status: "AWAITING_APPROVAL" },
        })
      : Promise.resolve();

  if (!po) {
    console.log("  FAIL no AWAITING_APPROVAL PO fixture (run pnpm db:seed)");
    failed++;
  } else {
    // 1) VIEWER forbidden (no state change); OPS approves → APPROVED → SENT + audit.
    await check(
      "VIEWER forbidden; OPS approve → APPROVED→SENT + audited approver",
      async () => {
        await resetPO();
        let forbade = false;
        try {
          await decide("po.approve", po.id, "APPROVE", viewer);
        } catch {
          forbade = true; // requireRole threw
        }
        const afterViewer = await db.purchaseOrder.findFirst({
          where: { id: po.id },
          select: { status: true },
        });
        const noChange = afterViewer?.status === "AWAITING_APPROVAL";

        const r1 = await decide("po.approve", po.id, "APPROVE", ops); // → APPROVED
        const r2 = await decide("po.approve", po.id, "APPROVE", ops); // → SENT
        const now = await db.purchaseOrder.findFirst({
          where: { id: po.id },
          select: { status: true },
        });
        const audit = await db.auditLog.findFirst({
          where: { action: "po.approve.approve", targetId: po.id },
          orderBy: { createdAt: "desc" },
        });
        return (
          forbade &&
          noChange &&
          r1.ok &&
          r2.ok &&
          now?.status === "SENT" &&
          !!audit &&
          audit.actorType === "HUMAN" &&
          audit.actorId === ops.id
        );
      },
    );

    // 2) reject audits + a second decide on a non-pending target is "already decided".
    await check(
      "reject → REJECTED + audited; second decide is 'already decided'",
      async () => {
        await resetPO();
        const rej = await decide("po.approve", po.id, "REJECT", ops);
        const now = await db.purchaseOrder.findFirst({
          where: { id: po.id },
          select: { status: true },
        });
        const audit = await db.auditLog.findFirst({
          where: { action: "po.approve.reject", targetId: po.id },
        });
        const again = await decide("po.approve", po.id, "APPROVE", ops);
        return (
          rej.ok &&
          now?.status === "REJECTED" &&
          !!audit &&
          again.ok === false &&
          again.reason === "already_decided"
        );
      },
    );

    // 4) cross-org decide blocked — a demo PO is unreachable via an org-2 approver.
    await check(
      "cross-org decide blocked (target not found via other org)",
      async () => {
        const crossOps = { ...ops, orgId: org2.id };
        const res = await decide("po.approve", po.id, "APPROVE", crossOps);
        return res.ok === false && res.reason === "not_found";
      },
    );
  }

  // 3) workflow.gate approve resumes a parked run (leaves AWAITING_APPROVAL, trace
  //    gains an "approved by" line) + audits. Use a freshly-created parked run.
  await check(
    "workflow.gate approve resumes a parked run + audits",
    async () => {
      const wf = await db.workflow.findFirst({
        where: { name: { contains: "Procurement" } },
        select: { id: true },
      });
      if (!wf) return false;
      const parked = await executeWorkflowRun(
        { workflowId: wf.id, orgId: org.id, triggerPayload: { value: 48000 } },
        { model: fake() },
      );
      createdRunIds.push(parked.runId);
      if (parked.status !== "AWAITING_APPROVAL") return false;

      const res = await decide("workflow.gate", parked.runId, "APPROVE", ops);
      const runNow = await db.workflowRun.findFirst({
        where: { id: parked.runId },
        select: { status: true, trace: true },
      });
      const traceText = JSON.stringify(runNow?.trace ?? []);
      const audit = await db.auditLog.findFirst({
        where: { action: "workflow.gate.approve", targetId: parked.runId },
      });
      return (
        res.ok &&
        runNow?.status !== "AWAITING_APPROVAL" &&
        /approved by/i.test(traceText) &&
        !!audit
      );
    },
  );

  // --- self-clean: restore the PO + delete created runs + audit rows ---
  await resetPO();
  await prisma.workflowRun.deleteMany({ where: { id: { in: createdRunIds } } });
  // VERIFY.4 — the audit rows this run wrote are restored BY ID by the guard
  // below (it captured "AuditLog" before the run). The old `action LIKE
  // 'po.approve.%'` / `'workflow.gate.%'` deletes were redundant AND unsafe: a
  // wildcard cannot tell this run's rows from seeded or foreign ones.
  await _guard.restore();
  await prisma.$disconnect();
  finish();
}

function finish(): void {
  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
