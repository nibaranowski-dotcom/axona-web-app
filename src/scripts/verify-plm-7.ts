/**
 * Verify PLM.7 — the Test Run (`Test Run.dc.html`). The FROZEN config snapshot is
 * the hero. Run: pnpm verify:plm-7
 *
 *   1. Route + view exist; DETAIL screen → full breadcrumbs (Quality › Test explorer › TR).
 *   2. The rendered snapshot comes from TestRun.configSnapshot (FROZEN), NOT a live
 *      re-resolve — mutating the unit's CURRENT config does NOT change this page.
 *   3. Per-step limits + pass/fail render; the failing step is surfaced.
 *   4. Links resolve: unit → /units/:serial, as-designed → /units/:serial/as-built,
 *      the triggering NCR is linked.
 *   5. Per-tenant isolation — a second org cannot read this run.
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

const DEMO = "org_axona_demo";
const SECOND = "org_isolation_test";

async function run(): Promise<void> {
  console.log("\nVerifying PLM.7 — the Test Run (frozen config is the hero)\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const page = read("apps/web/app/(shell)/tests/[code]/page.tsx");
  const view = read("apps/web/components/tests/TestRunView.tsx");

  await check("/tests/:code route + view exist; loads getTestRun", () => {
    return page.length > 0 && view.length > 0 && /getTestRun/.test(page);
  });
  await check(
    "DETAIL screen → full breadcrumb trail (Quality › Test explorer)",
    () => {
      return (
        /aria-label="Breadcrumb"/.test(view) &&
        /Test explorer/.test(view) &&
        /\/quality/.test(view)
      );
    },
  );
  await check(
    "the frozen snapshot is rendered from run.snapshot (not re-resolved)",
    () => {
      return (
        /Frozen configuration/.test(view) &&
        /immutable · at run time/.test(view) &&
        /run\.snapshot/.test(view)
      );
    },
  );
  await check("v2 tokens only · no invented reds on the run page", () => {
    return (
      !/#[0-9a-fA-F]{3,6}\b/.test(view) &&
      !/\bbg-red|text-red|border-red\b/.test(view)
    );
  });

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP data checks — DATABASE_URL not set");
    if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
    else {
      console.log(`\nFAILED — ${failed} check(s) failed`);
      process.exit(1);
    }
    return;
  }

  const { getTestRun } = await import("../../apps/web/lib/tests");
  const { prisma, dbForOrg } = await import("@axona/db");

  await check(
    "TR-8841 loads with frozen snapshot + steps + limits",
    async () => {
      const r = await getTestRun(DEMO, "TR-8841");
      if (!r) return false;
      const failStep = r.steps.find((s) => !s.passed);
      return (
        r.outcome === "fail" &&
        r.snapshot?.configVersion?.name === "CFG-HX2-r4.2" &&
        r.snapshot?.sw?.version === "v4.2.1" &&
        r.steps.length >= 2 &&
        !!failStep &&
        failStep.upperLimit != null && // per-step limits render
        r.stepFailCount >= 1
      );
    },
  );

  // ── 2 (the hero invariant): the page's snapshot resists a live config change ──
  await check(
    "changing the unit's CURRENT config does NOT alter this run's rendered snapshot",
    async () => {
      const db = dbForOrg(DEMO);
      const unit = await prisma.unit.findFirst({
        where: { orgId: DEMO, serial: "SN-2208" },
        select: { id: true },
      });
      if (!unit) return false;

      const guard = await captureSeededState(prisma as never, [
        "SoftwareRelease",
        "UnitSoftwareState",
      ]);
      try {
        const before = await getTestRun(DEMO, "TR-8841");
        const swBefore = before?.snapshot?.sw?.version;

        // mutate the unit's CURRENT config
        const rel = await db.softwareRelease.create({
          data: { orgId: DEMO, component: "firmware", version: "v9.9.9-plm7" },
        });
        await db.unitSoftwareState.create({
          data: {
            orgId: DEMO,
            unitId: unit.id,
            softwareReleaseId: rel.id,
            effectiveFrom: new Date(),
          },
        });

        const after = await getTestRun(DEMO, "TR-8841");
        const swAfter = after?.snapshot?.sw?.version;
        // the run page still shows the frozen v4.2.1 — never the live v9.9.9
        return swBefore === "v4.2.1" && swAfter === "v4.2.1";
      } finally {
        await guard.restore();
      }
    },
  );

  await check(
    "links resolve: unit page · as-designed diff · triggering NCR",
    async () => {
      const r = await getTestRun(DEMO, "TR-8841");
      return (
        !!r &&
        r.unitHref === "/units/SN-2208" &&
        r.asBuiltHref === "/units/SN-2208/as-built" &&
        r.ncr?.code === "NCR-118"
      );
    },
  );

  await check("isolation: a second org cannot read this run", async () => {
    const r = await getTestRun(SECOND, "TR-8841");
    return r === null;
  });

  await prisma.$disconnect();

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run().then(() => process.exit(failed > 0 ? 1 : 0));
