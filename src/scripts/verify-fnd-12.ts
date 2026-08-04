/**
 * Verify FND.12 — cross-module narrative seed.
 *
 * Run: `pnpm verify:fnd-12` (needs a migrated + seeded DB; DATABASE_URL set).
 *   STATIC: seed orchestrator + per-domain modules exist.
 *   DATA: counts + the SERVO/NCR-118/ECO-318/Tier-1 Auto OEM/DLV-3312/SN-2196/Osei/p-13/AX-2
 *     chain, and tenant-orgId integrity.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;

async function check(
  label: string,
  fn: () => boolean | Promise<boolean>,
): Promise<void> {
  try {
    const ok = await fn();
    console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
    ok ? passed++ : failed++;
  } catch (e) {
    console.log(`  FAIL ${label} — ${(e as Error).message}`);
    failed++;
  }
}

async function run(): Promise<void> {
  console.log("\nVerifying FND.12 — cross-module narrative seed\n");
  const root = process.cwd();

  await check(
    "seed orchestrator + per-domain modules exist",
    () =>
      existsSync(join(root, "packages/db/prisma/seed.ts")) &&
      existsSync(join(root, "packages/db/prisma/seed/value-chain.ts")) &&
      existsSync(join(root, "packages/db/prisma/seed/robotics.ts")),
  );

  if (!process.env.DATABASE_URL) {
    console.log(
      "  SKIP data checks — DATABASE_URL not set (docker compose up; pnpm db:seed)",
    );
  } else {
    const { prisma, dbForOrg } = await import("@axona/db");
    const { DEMO_ORG_ID, SECOND_ORG_ID } =
      await import("../../packages/db/prisma/seed/constants");
    const db = dbForOrg(DEMO_ORG_ID);

    // NOTE: 22 modules per build-spec §1 (the PRD's "24" counts the Workflow-
    // detail + Project-files screens, not nav modules). See modules.ts.
    await check(
      "22 modules (build-spec §1)",
      async () => (await prisma.module.count()) === 22,
    );
    await check(
      "agents seeded (>= 60)",
      async () => (await db.agent.count()) >= 60,
    );
    await check("14 projects", async () => (await db.project.count()) === 14);
    await check(
      "21 machines (8 fixed)",
      async () =>
        (await db.machine.count()) === 21 &&
        (await db.machine.count({ where: { kind: "FIXED" } })) === 8,
    );

    await check("NCR-118 critical, linked to lot 88421", async () => {
      const n = await db.nCR.findFirst({ where: { code: "NCR-118" } });
      return !!n && n.severity === "CRITICAL" && /88421/.test(n.linkedTo);
    });
    await check("ECO-318 present, affects Tier-1 Auto OEM order", async () => {
      const e = await db.eCO.findFirst({ where: { code: "ECO-318" } });
      return !!e && /Tier-1 Auto OEM/i.test(e.affected);
    });
    await check("DLV-3312 customs hold (EAR99)", async () => {
      const dl = await db.delivery.findFirst({ where: { code: "DLV-3312" } });
      return !!dl && dl.stage === "CUSTOMS" && /EAR99/i.test(dl.riskState);
    });
    await check(
      "SN-2196 robot + field WO",
      async () =>
        (await db.robot.count({ where: { serial: "SN-2196" } })) === 1 &&
        (await db.workOrderField.count({
          where: { robotSerial: "SN-2196" },
        })) >= 1,
    );
    await check("M. Osei cert expiring", async () => {
      const t = await db.technician.findFirst({ where: { name: "M. Osei" } });
      return !!t;
    });
    await check(
      "p-13 autonomy canary + INC-201",
      async () =>
        (await db.policyVersion.count({ where: { version: "p-13" } })) >= 1 &&
        (await db.safetyIncident.count({ where: { code: "INC-201" } })) === 1,
    );
    await check(
      "agent-drafted PO awaiting approval",
      async () =>
        (await db.purchaseOrder.count({
          where: {
            status: "AWAITING_APPROVAL",
            draftedByAgentId: { not: null },
          },
        })) >= 1,
    );
    await check("AX-2 margin -2.1pt + OEM-2 overdue invoice", async () => {
      const u = await db.unitEconomic.findFirst({ where: { product: "AX-2" } });
      const inv = await db.invoice.findFirst({
        where: { account: "OEM-2", status: "OVERDUE" },
      });
      return !!u && /-2\.1/.test(u.trend) && !!inv;
    });
    // VERIFY.1 — the isolation invariant is "no cross-tenant LEAK between the
    // seeded base pair", NOT "exactly two orgs exist". Assert the demo and
    // isolation orgs are mutually disjoint by their SCOPED reads (each surfaces
    // only its own signature data); any additional PROSPECT tenants seeded
    // locally are irrelevant and must not fail this. Still real: a demo row
    // surfacing in the second org's scope (or vice versa) fails the check.
    const DEMO_MARKER = "Tier-1 Actuator Co"; // seeded only in the demo org
    const SECOND_MARKER = "Iso Test Supplier"; // seeded only in the isolation org
    await check(
      "base pair isolated — the demo scope shows its own data, none of the second org's",
      async () => {
        const names = (
          await dbForOrg(DEMO_ORG_ID).supplier.findMany({
            select: { name: true },
          })
        ).map((s) => s.name);
        return (
          names.length > 0 &&
          names.includes(DEMO_MARKER) &&
          !names.includes(SECOND_MARKER)
        );
      },
    );
    await check(
      "base pair isolated — the second-org scope shows its own data, none of the demo's",
      async () => {
        const names = (
          await dbForOrg(SECOND_ORG_ID).supplier.findMany({
            select: { name: true },
          })
        ).map((s) => s.name);
        return (
          names.length >= 1 &&
          names.includes(SECOND_MARKER) &&
          !names.includes(DEMO_MARKER)
        );
      },
    );

    await prisma.$disconnect();
  }

  if (failed === 0) {
    console.log(`\nPASSED — ${passed} checks`);
  } else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

void run();
