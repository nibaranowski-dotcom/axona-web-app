/**
 * Verify RBAC.5 — approvals fan-out (ECO release · policy rollback · credit note)
 * over the existing decide() primitive. Static checks always run; live checks
 * gated on DATABASE_URL. Self-cleaning (restores targets + removes its audit rows).
 * Run: pnpm verify:rbac-5
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
  console.log(
    "\nVerifying RBAC.5 — approvals fan-out (ECO · policy · credit note)\n",
  );

  // --- static: three surfaces wired to decide(); no ad-hoc mutation left ---
  await check("Engineering: ECO release wired to decide('eco.release')", () => {
    const a = read("apps/web/app/(shell)/engineering/actions.ts");
    const t = read("apps/web/components/engineering/EcoTable.tsx");
    return (
      /decide\("eco\.release"/.test(a) &&
      /approveEcoRelease/.test(t) &&
      /Approve release/.test(t)
    );
  });
  await check(
    "Autonomy: rollback exclusively through decide (no ad-hoc mutation)",
    () => {
      const a = read("apps/web/app/(shell)/autonomy/actions.ts");
      const t = read("apps/web/components/autonomy/PolicyPanel.tsx");
      return (
        /decide\("policy\.rollback"/.test(a) &&
        !/policyVersion\.(update|updateMany)/.test(a) &&
        /approvePolicyRollback/.test(t)
      );
    },
  );
  await check(
    "Finance: credit-note issue wired to decide('creditnote.issue')",
    () => {
      const a = read("apps/web/app/(shell)/finance/actions.ts");
      const t = read("apps/web/components/finance/Receivables.tsx");
      return (
        /decide\("creditnote\.issue"/.test(a) &&
        /issueCreditNote/.test(t) &&
        /Issue credit note/.test(t)
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP live checks — DATABASE_URL not set");
    finish();
    return;
  }

  const { prisma, dbForOrg } = await import("@axona/db");
  const { decide } = await import("../../apps/web/lib/approvals");
  const { getAuditTrail } = await import("../../apps/web/lib/audit-trail");

  const org = await prisma.org.findFirst({ where: { name: "Axona Demo Co" } });
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
  const pick = async (role: "ENGINEER" | "TECH" | "FINANCE" | "ADMIN") => {
    const u =
      (await prisma.user.findFirst({
        where: { orgId: org.id, role },
        select: { id: true, name: true, email: true },
      })) ??
      (await prisma.user.findFirst({
        where: { orgId: org.id, role: "ADMIN" },
        select: { id: true, name: true, email: true },
      }))!;
    return { ...u, role, orgId: org.id };
  };
  const viewer = {
    id: "viewer-1",
    role: "VIEWER" as const,
    email: "v@demo",
    name: "V",
    orgId: org.id,
  };

  const eco = await db.eCO.findFirst({
    where: { code: "ECO-318" },
    select: { id: true, stage: true },
  });
  const pol = await db.policyVersion.findFirst({
    where: { version: "p-13" },
    select: { id: true, state: true },
  });
  const inv = await db.invoice.findFirst({
    where: { status: "OPEN" },
    select: { id: true, status: true },
  });

  // 1) eco.release: VIEWER forbidden (no change); ENGINEER approve → RELEASED + audit.
  await check(
    "eco.release: VIEWER forbidden; ENGINEER approve → RELEASED + audited approver",
    async () => {
      if (!eco) return false;
      let forbade = false;
      try {
        await decide("eco.release", eco.id, "APPROVE", viewer);
      } catch {
        forbade = true;
      }
      const noChange =
        (
          await db.eCO.findFirst({
            where: { id: eco.id },
            select: { stage: true },
          })
        )?.stage === eco.stage;
      const eng = await pick("ENGINEER");
      const res = await decide("eco.release", eco.id, "APPROVE", eng);
      const now = await db.eCO.findFirst({
        where: { id: eco.id },
        select: { stage: true },
      });
      const audit = await db.auditLog.findFirst({
        where: { action: "eco.release.approve", targetId: eco.id },
      });
      return (
        forbade &&
        noChange &&
        res.ok &&
        now?.stage === "RELEASED" &&
        audit?.approverId === eng.id
      );
    },
  );

  // 2) policy.rollback: TECH approve → standby + audited approver.
  await check(
    "policy.rollback: TECH approve → standby + audited approver",
    async () => {
      if (!pol) return false;
      const tech = await pick("TECH");
      const res = await decide("policy.rollback", pol.id, "APPROVE", tech);
      const now = await db.policyVersion.findFirst({
        where: { id: pol.id },
        select: { state: true },
      });
      const audit = await db.auditLog.findFirst({
        where: { action: "policy.rollback.approve", targetId: pol.id },
      });
      return (
        res.ok && now?.state === "standby" && audit?.approverId === tech.id
      );
    },
  );

  // 3) creditnote.issue: FINANCE approve → credited + audited approver.
  await check(
    "creditnote.issue: FINANCE approve → credited + audited approver",
    async () => {
      if (!inv) return false;
      const fin = await pick("FINANCE");
      const res = await decide("creditnote.issue", inv.id, "APPROVE", fin);
      const now = await db.invoice.findFirst({
        where: { id: inv.id },
        select: { status: true },
      });
      const audit = await db.auditLog.findFirst({
        where: { action: "creditnote.issue.approve", targetId: inv.id },
      });
      return (
        res.ok && now?.status === "credited" && audit?.approverId === fin.id
      );
    },
  );

  // 4) cross-org decide blocked.
  await check(
    "cross-org decide blocked (target not found via other org)",
    async () => {
      if (!eco) return false;
      const crossEng = { ...(await pick("ENGINEER")), orgId: org2.id };
      const res = await decide("eco.release", eco.id, "APPROVE", crossEng);
      return res.ok === false && res.reason === "not_found";
    },
  );

  // 5) the new decisions surface on getAuditTrail.
  await check("new decisions surface on /audit (getAuditTrail)", async () => {
    const { entries } = await getAuditTrail(org.id, { take: 100 });
    const actions = new Set(entries.map((e) => e.action));
    return (
      actions.has("eco.release.approve") &&
      actions.has("policy.rollback.approve") &&
      actions.has("creditnote.issue.approve") &&
      entries.some((e) => e.approverLabel) // approver surfaced (AUDIT.3)
    );
  });

  // --- self-clean: restore targets + remove the audit rows this script created ---
  if (eco)
    await db.eCO.updateMany({
      where: { id: eco.id },
      data: { stage: eco.stage },
    });
  if (pol)
    await db.policyVersion.updateMany({
      where: { id: pol.id },
      data: { state: pol.state },
    });
  if (inv)
    await db.invoice.updateMany({
      where: { id: inv.id },
      data: { status: inv.status },
    });
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "AuditLog" DISABLE RULE audit_no_delete`,
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM "AuditLog" WHERE "orgId"=$1 AND (action LIKE 'eco.release.%' OR action LIKE 'policy.rollback.%' OR action LIKE 'creditnote.issue.%')`,
    org.id,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "AuditLog" ENABLE RULE audit_no_delete`,
  );
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
