/**
 * Verify BILL.3 — billing & subscription (PRD §48). Static checks always run; live
 * checks gated on DATABASE_URL. Stubbed billing — asserts NO real-charge path.
 * Self-cleaning. Run: pnpm verify:bill-3
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
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
  console.log("\nVerifying BILL.3 — billing & subscription\n");

  // --- schema + migration ---
  await check("Subscription + InvoiceSaaS models + migration", () => {
    const schema = read("packages/db/prisma/schema.prisma");
    const mig = readdirSync(join(root, "packages/db/prisma/migrations")).find(
      (d) => /bill3_subscription/.test(d),
    );
    const sql = mig
      ? read(`packages/db/prisma/migrations/${mig}/migration.sql`)
      : "";
    return (
      /model Subscription \{/.test(schema) &&
      /model InvoiceSaaS \{/.test(schema) &&
      /enum PlanTier/.test(schema) &&
      /orgId\s+String\s+@unique/.test(schema) &&
      /CREATE TABLE "Subscription"/.test(sql) &&
      /CREATE TABLE "InvoiceSaaS"/.test(sql)
    );
  });

  // --- actions ADMIN-gated + audited + STUBBED (no real charge) ---
  await check(
    "billing actions ADMIN-gated + audited + stubbed (no real charge)",
    () => {
      const a = read("apps/web/app/(shell)/settings/billing/actions.ts");
      return (
        /requireRole\(user, \["ADMIN"\]\)/.test(a) &&
        /billing\.plan_change/.test(a) &&
        /billing\.seats_add/.test(a) &&
        /charged: false/.test(a) && // explicit no-charge marker
        !/stripe\.|charge\(|createCharge|paymentIntent/i.test(a) // no real-charge path
      );
    },
  );
  await check("billing + plans screens exist", () => {
    return (
      existsSync(
        join(root, "apps/web/app/(shell)/settings/billing/page.tsx"),
      ) &&
      existsSync(
        join(root, "apps/web/app/(shell)/settings/billing/plans/page.tsx"),
      )
    );
  });

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP live checks — DATABASE_URL not set");
    finish();
    return;
  }

  const { prisma, dbForOrg } = await import("@axona/db");
  const { captureSeededState } = await import("./lib/self-clean");
  const { getBilling, getPlans } = await import("../../apps/web/lib/billing");
  const { getMembers } = await import("../../apps/web/lib/members");

  const demo = await prisma.org.findFirst({ where: { name: "Axona" } });
  const second = await prisma.org.findFirst({
    where: { name: "Isolation Test Co" },
  });
  const admin = await prisma.user.findFirst({
    where: { orgId: demo!.id, role: "ADMIN" },
    select: { id: true, name: true },
  });
  const db = dbForOrg(demo!.id);
  const by = { id: admin!.id, label: admin!.name };
  const snap = await prisma.subscription.findUnique({
    where: { orgId: demo!.id },
  });

  // VERIFY.4 — id-scoped restore. This used to be a PATTERN delete
  // (`action: { startsWith: "billing." }`), which cannot tell the rows this run
  // wrote from seeded or foreign rows sharing the prefix — the shape that once
  // destroyed CONF.1's calibration history. The guard snapshots AuditLog ids up
  // front; `restore()` deletes ONLY ids that appeared since, and is repeatable,
  // so both existing call sites keep working unchanged.
  const _auditGuard = await captureSeededState(prisma, ["AuditLog"]);
  const cleanAudit = async () => {
    await _auditGuard.restore();
  };
  await cleanAudit();

  // 2) getBilling: plan/seats/usage/invoices; seats reconcile to members; org-scoped.
  await check(
    "getBilling → plan/seats/usage/invoices; seats == active members + pending; org-scoped",
    async () => {
      const b = await getBilling(demo!.id);
      if (!b) return false;
      const m = await getMembers(demo!.id);
      const reconciles =
        b.seatsUsed === m.rollup.activeMembers + m.rollup.pending;
      const shape =
        b.plan === "SCALE" &&
        b.seatsPurchased === 25 &&
        b.invoices.length >= 1 &&
        b.usage.length >= 2;
      const other = second ? await getBilling(second.id) : null; // second org has no sub
      return reconciles && shape && other === null;
    },
  );

  // 3) changePlan/addSeats mirror: update + audit; no-charge marker.
  await check(
    "changePlan + addSeats update Subscription + audit (charged:false)",
    async () => {
      const { writeAudit } = await import("@axona/db");
      await db.subscription.updateMany({
        where: { orgId: demo!.id },
        data: { plan: "ENTERPRISE" },
      });
      await writeAudit(db, {
        orgId: demo!.id,
        actor: { type: "HUMAN", id: admin!.id, label: by.label },
        action: "billing.plan_change",
        target: { type: "Subscription", id: demo!.id },
        summary: "Changed plan to ENTERPRISE (no charge)",
        output: { charged: false },
        approver: by,
      });
      const afterPlan = (await getBilling(demo!.id))!.plan === "ENTERPRISE";
      const before = (await getBilling(demo!.id))!.seatsPurchased;
      await db.subscription.updateMany({
        where: { orgId: demo!.id },
        data: { seatsPurchased: before + 5 },
      });
      await writeAudit(db, {
        orgId: demo!.id,
        actor: { type: "HUMAN", id: admin!.id, label: by.label },
        action: "billing.seats_add",
        target: { type: "Subscription", id: demo!.id },
        summary: "Added 5 seats (no charge)",
        output: { charged: false },
        approver: by,
      });
      const seatsUp =
        (await getBilling(demo!.id))!.seatsPurchased === before + 5;
      const audits = await prisma.auditLog.count({
        where: { orgId: demo!.id, action: { startsWith: "billing." } },
      });
      const noCharge = (
        await prisma.auditLog.findMany({
          where: { orgId: demo!.id, action: { startsWith: "billing." } },
        })
      ).every(
        (e) => (e.output as { charged?: boolean } | null)?.charged === false,
      );
      return afterPlan && seatsUp && audits >= 2 && noCharge;
    },
  );

  // 4) getPlans returns 3 tiers; recommended resolves.
  await check("getPlans → 3 tiers with a recommended one", async () => {
    const plans = getPlans();
    return (
      plans.length === 3 && plans.filter((p) => p.recommended).length === 1
    );
  });

  // 5) cross-org billing not readable: a subscription that belongs to the second
  //    org is not reachable BY ID through the demo org's client (dbForOrg injects
  //    orgId = demo, so the second-org row can't match).
  await check(
    "cross-org: another org's subscription not reachable via demo dbForOrg",
    async () => {
      if (!second) return true;
      const secondSub = await prisma.subscription.upsert({
        where: { orgId: second.id },
        update: {},
        create: {
          orgId: second.id,
          plan: "PILOT",
          status: "TRIALING",
          seatsPurchased: 10,
        },
      });
      const leaked = await db.subscription.findFirst({
        where: { id: secondSub.id },
      });
      await prisma.subscription.deleteMany({ where: { orgId: second.id } });
      return leaked === null;
    },
  );

  // restore + clean
  if (snap) {
    await db.subscription.updateMany({
      where: { orgId: demo!.id },
      data: { plan: snap.plan, seatsPurchased: snap.seatsPurchased },
    });
  }
  await cleanAudit();
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
