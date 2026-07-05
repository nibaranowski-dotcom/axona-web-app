/**
 * Verify AUDIT.1 — immutable event log + writer (PRD §9). Static checks always
 * run; live checks gated on DATABASE_URL. Self-cleaning: the rows/runs it creates
 * are removed (the audit rows via the admin disable-rule path, like the seed), so
 * the seeded state is restored. Run: pnpm verify:audit-1
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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
  console.log("\nVerifying AUDIT.1 — immutable event log + writer\n");

  // --- static: writer wired at the four base call sites + the append-only rule ---
  // (RBAC.4 moved the PO audit from actions.ts's inline po.advance into the shared
  //  decide() primitive, which audits every gated decision as `${kind}.${decision}`.)
  const approvals = read("apps/web/lib/approvals.ts");
  const executor = read("packages/agents/src/workflow/executor.ts");
  const matrixJob = read("packages/agents/src/matrix/job.ts");
  const fileRoute = read("apps/web/app/api/projects/[id]/files/route.ts");
  const migration = read(
    "packages/db/prisma/migrations/20260704085500_audit1_audit_log/migration.sql",
  );
  const poWired =
    /writeAudit\(/.test(approvals) &&
    /\$\{kind\}\.\$\{decision\.toLowerCase\(\)\}/.test(approvals);

  await check(
    "writeAudit wired at all 4 sites (po-via-decide/workflow/column/file)",
    () => {
      return (
        poWired &&
        /writeAudit/.test(executor) &&
        /"workflow\.run"/.test(executor) &&
        /correlationId: job\.runId/.test(executor) &&
        /writeAudit/.test(matrixJob) &&
        /"column\.extract"/.test(matrixJob) &&
        /writeAudit/.test(fileRoute) &&
        /"file\.upload"/.test(fileRoute)
      );
    },
  );
  await check(
    "migration is append-only (CREATE RULE no_update + no_delete)",
    () => {
      return (
        /CREATE RULE "audit_no_update" AS ON UPDATE TO "AuditLog" DO INSTEAD NOTHING/.test(
          migration,
        ) &&
        /CREATE RULE "audit_no_delete" AS ON DELETE TO "AuditLog" DO INSTEAD NOTHING/.test(
          migration,
        )
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP live checks — DATABASE_URL not set");
  } else {
    const { prisma, dbForOrg, writeAudit } = await import("@axona/db");
    const { executeWorkflowRun, FakeModelClient } =
      await import("@axona/agents");
    const fake = () =>
      new FakeModelClient([
        {
          stopReason: "end_turn",
          text: "done",
          toolUses: [],
          model: "fake-model",
        },
      ]);

    const org = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    const org2 = await prisma.org.findFirst({
      where: { name: "Isolation Test Co" },
    });
    if (!org || !org2) {
      console.log("  FAIL demo/second org missing (run pnpm db:seed)");
      failed++;
    } else {
      const db = dbForOrg(org.id);
      const db2 = dbForOrg(org2.id);
      const createdRunIds: string[] = [];

      // 1) writeAudit inserts org-scoped; a forced failure does NOT throw.
      await check(
        "writeAudit inserts org-scoped; a forced failure never throws",
        async () => {
          await writeAudit(db, {
            orgId: org.id,
            actor: { type: "SYSTEM", label: "verify" },
            action: "verify.audit.write",
            target: { type: "Verify", id: "vrow" },
            summary: "verify insert",
            output: { ok: true },
          });
          const row = await db.auditLog.findFirst({
            where: { action: "verify.audit.write" },
            orderBy: { createdAt: "desc" },
          });
          const inserted =
            !!row &&
            row.orgId === org.id &&
            row.actorLabel === "verify" &&
            (row.output as { ok?: boolean } | null)?.ok === true;

          const before = await db.auditLog.count();
          const throwingDb = {
            auditLog: {
              create: async () => {
                throw new Error("boom");
              },
            },
          } as unknown as typeof db;
          let threw = false;
          try {
            await writeAudit(throwingDb, {
              orgId: org.id,
              actor: { type: "SYSTEM", label: "x" },
              action: "verify.audit.fail",
              target: { type: "Verify", id: "x" },
              summary: "x",
            });
          } catch {
            threw = true;
          }
          const after = await db.auditLog.count();
          return inserted && !threw && after === before;
        },
      );

      // 2) append-only: UPDATE and DELETE are no-ops (the DB rule holds).
      await check(
        "UPDATE and DELETE on a row are no-ops (rule holds)",
        async () => {
          const r = await db.auditLog.findFirst({
            where: { action: "verify.audit.write" },
          });
          if (!r) return false;
          await prisma.$executeRawUnsafe(
            `UPDATE "AuditLog" SET summary='HACKED' WHERE id=$1`,
            r.id,
          );
          await prisma.$executeRawUnsafe(
            `DELETE FROM "AuditLog" WHERE id=$1`,
            r.id,
          );
          const still = await db.auditLog.findFirst({ where: { id: r.id } });
          return (
            !!still && still.summary === r.summary && still.summary !== "HACKED"
          );
        },
      );

      // 3) a workflow run writes workflow.run w/ correlationId = runId; po.advance wired.
      await check(
        "workflow run writes workflow.run w/ runId correlationId; po.advance wired",
        async () => {
          const wf = await db.workflow.findFirst({ select: { id: true } });
          if (!wf) return false;
          const { runId } = await executeWorkflowRun(
            { workflowId: wf.id, orgId: org.id },
            { model: fake() },
          );
          createdRunIds.push(runId);
          const audit = await db.auditLog.findFirst({
            where: { action: "workflow.run", targetId: runId },
          });
          return !!audit && audit.correlationId === runId && poWired;
        },
      );

      // 4) cross-org read isolation — org A's trail is invisible through org B.
      await check("cross-org read blocked", async () => {
        const demoRow = await db.auditLog.findFirst({
          where: { action: "po.advance" },
        });
        const crossById = demoRow
          ? await db2.auditLog.findFirst({ where: { id: demoRow.id } })
          : null;
        const crossByAction = await db2.auditLog.findFirst({
          where: { action: "po.advance" },
        });
        return !!demoRow && crossById === null && crossByAction === null;
      });

      // 5) seed produced the historical trail spanning the through-line targets.
      await check(
        "seed produced entries spanning the through-line",
        async () => {
          const count = await db.auditLog.count();
          const types = new Set(
            (await db.auditLog.findMany({ select: { targetType: true } })).map(
              (x) => x.targetType,
            ),
          );
          return (
            count >= 15 &&
            types.has("PurchaseOrder") &&
            types.has("File") &&
            types.has("MatrixColumn")
          );
        },
      );

      // --- self-clean: remove the rows/runs this script created (admin path) ---
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "AuditLog" DISABLE RULE audit_no_delete`,
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM "AuditLog" WHERE "orgId"=$1 AND action LIKE 'verify.%'`,
        org.id,
      );
      if (createdRunIds.length) {
        await prisma.$executeRawUnsafe(
          `DELETE FROM "AuditLog" WHERE action='workflow.run' AND "targetId" = ANY($1::text[])`,
          createdRunIds,
        );
      }
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "AuditLog" ENABLE RULE audit_no_delete`,
      );
      await prisma.workflowRun.deleteMany({
        where: { id: { in: createdRunIds } },
      });
    }
    await prisma.$disconnect();
  }

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
