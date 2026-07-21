/**
 * Verify AUDIT.3 — record model · confidence · approver on the audit log. Static
 * checks always run; live checks gated on DATABASE_URL. Uses FakeModelClient
 * (offline). Self-cleaning (admin disable-rule path). Run: pnpm verify:audit-3
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
  console.log("\nVerifying AUDIT.3 — model · confidence · approver\n");

  // --- static: schema columns + writer persists them + CONF.1 seam ---
  await check(
    "AuditLog has model/confidence/approverId/approverLabel + CONF.1 seam",
    () => {
      const schema = read("packages/db/prisma/schema.prisma");
      return (
        /model\s+String\?/.test(schema) &&
        /confidence\s+Float\?/.test(schema) &&
        /approverId\s+String\?/.test(schema) &&
        /approverLabel\s+String\?/.test(schema) &&
        /CONF\.1/.test(schema)
      );
    },
  );
  await check("writeAudit persists model/confidence/approver", () => {
    const audit = read("packages/db/src/audit.ts");
    return (
      /model:\s*e\.model/.test(audit) &&
      /confidence:\s*e\.confidence/.test(audit) &&
      /approverId:\s*e\.approver\?\.id/.test(audit) &&
      /approverLabel:\s*e\.approver\?\.label/.test(audit)
    );
  });
  await check("migration adds the 4 columns (via migrate, not db push)", () => {
    return /ALTER TABLE "AuditLog" ADD COLUMN "model"/.test(
      read(
        "packages/db/prisma/migrations/20260705120000_audit3_model_confidence_approver/migration.sql",
      ),
    );
  });

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
  if (!org) {
    console.log("  FAIL demo org missing (run pnpm db:seed)");
    failed++;
    finish();
    return;
  }
  const db = dbForOrg(org.id);
  const admin = await prisma.user.findFirst({
    where: { orgId: org.id, role: "ADMIN" },
    select: { id: true, name: true, email: true },
  });
  const createdRunIds: string[] = [];

  // Create a parked run (agent) then approve it (human) — covers both entry kinds.
  const wf = await db.workflow.findFirst({
    where: { name: { contains: "Procurement" } },
    select: { id: true },
  });
  const parked = wf
    ? await executeWorkflowRun(
        { workflowId: wf.id, orgId: org.id, triggerPayload: { value: 48000 } },
        { model: fake() },
      )
    : null;
  if (parked) createdRunIds.push(parked.runId);

  // 1) an AGENT entry (workflow.run) carries non-null model + confidence, no approver.
  await check(
    "agent entry (workflow.run) carries model + confidence, no approver",
    async () => {
      if (!parked) return false;
      const a = await db.auditLog.findFirst({
        where: { action: "workflow.run", targetId: parked.runId },
      });
      return (
        !!a &&
        typeof a.model === "string" &&
        a.model.length > 0 &&
        typeof a.confidence === "number" &&
        a.approverId === null
      );
    },
  );

  // 2) a HUMAN approval entry carries a non-null approver; model/confidence null.
  await check(
    "approval entry carries approver; model + confidence null",
    async () => {
      if (!parked || !admin) return false;
      const res = await decide("workflow.gate", parked.runId, "APPROVE", {
        ...admin,
        role: "ADMIN" as const,
        orgId: org.id,
      });
      const a = await db.auditLog.findFirst({
        where: { action: "workflow.gate.approve", targetId: parked.runId },
      });
      return (
        res.ok &&
        !!a &&
        a.approverId === admin.id &&
        typeof a.approverLabel === "string" &&
        a.model === null &&
        a.confidence === null
      );
    },
  );

  // 3) append-only still holds — UPDATE/DELETE on an AUDIT.3-enriched row is a no-op.
  await check(
    "append-only preserved (UPDATE/DELETE no-op on an enriched row)",
    async () => {
      if (!parked) return false;
      const a = await db.auditLog.findFirst({
        where: { action: "workflow.run", targetId: parked.runId },
        select: { id: true, model: true },
      });
      if (!a) return false;
      await prisma.$executeRawUnsafe(
        `UPDATE "AuditLog" SET model='HACKED' WHERE id=$1`,
        a.id,
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM "AuditLog" WHERE id=$1`,
        a.id,
      );
      const still = await db.auditLog.findFirst({
        where: { id: a.id },
        select: { model: true },
      });
      return !!still && still.model === a.model && still.model !== "HACKED";
    },
  );

  // self-clean
  await prisma.workflowRun.deleteMany({ where: { id: { in: createdRunIds } } });
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "AuditLog" DISABLE RULE audit_no_delete`,
  );
  if (createdRunIds.length) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "AuditLog" WHERE "orgId"=$1 AND "targetId" = ANY($2::text[])`,
      org.id,
      createdRunIds,
    );
  }
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "AuditLog" ENABLE RULE audit_no_delete`,
  );
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
