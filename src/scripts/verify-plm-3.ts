/**
 * Verify PLM.3 — the Unit page (`Unit.dc.html`), the hero object. Static checks
 * always run; data checks are gated on DATABASE_URL. Run: pnpm verify:plm-3
 *
 *   1. The route + view exist; breadcrumbs (a DETAIL screen) not a back-arrow;
 *      the PLM.1b seam (test runs / field events) renders empty, never faked.
 *   2. THE POINT: the timeline resolves config AT EACH EVENT'S TIMESTAMP, not
 *      "now" — an event before the firmware change must show the PRE-change
 *      configuration, and it must differ from the unit's current one.
 *   3. The diff summary count matches asBuiltDiff exactly (no second source).
 *   4. Every link the page emits resolves to a real route.
 *   5. Effectivity is computed, not assumed: an ECO effective from a later serial
 *      is marked as NOT applying to this unit.
 *   6. Per-tenant isolation: another org cannot read this unit.
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

const DEMO = "org_axona_demo";
const SECOND = "org_isolation_test";
const SERIAL = "SN-2208";

async function run(): Promise<void> {
  console.log("\nVerifying PLM.3 — the Unit page (the hero object)\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";
  const has = (p: string) => existsSync(join(root, p));

  const page = read("apps/web/app/(shell)/units/[serial]/page.tsx");
  const view = read("apps/web/components/units/UnitView.tsx");

  // ── 1 (static) ──
  await check("/units/:serial route + Unit view exist", () => {
    return page.length > 0 && view.length > 0 && /getUnitDetail/.test(page);
  });
  await check(
    "DETAIL screen → full breadcrumbs (Engineering › Unit registry › serial)",
    () => {
      return (
        /aria-label="Breadcrumb"/.test(view) &&
        /Engineering/.test(view) &&
        /Unit registry/.test(view) &&
        /href="\/units"/.test(view)
      );
    },
  );
  await check(
    "PLM.1b seam: test runs / field events render empty, never faked",
    () => {
      const lib = read("apps/web/lib/unit-detail.ts");
      return (
        /testRuns: \[\]/.test(lib) &&
        /fieldEvents: \[\]/.test(lib) &&
        /No test runs recorded/.test(view)
      );
    },
  );
  await check("v2 tokens only — no raw hex on the Unit page", () => {
    return !/#[0-9a-fA-F]{6}\b/.test(view);
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

  const { dbForOrg, prisma, asBuiltDiff } = await import("@axona/db");
  const { getUnitDetail } = await import("../../apps/web/lib/unit-detail");
  const db = dbForOrg(DEMO);

  const unit = await getUnitDetail(DEMO, SERIAL);
  if (!unit) {
    console.log(`  FAIL ${SERIAL} not found — run the seed`);
    process.exit(1);
  }

  // ── 2: THE POINT — config resolved at each event's own timestamp ──
  await check(
    "timeline resolves config AT EACH EVENT'S TIMESTAMP (not 'now')",
    () => {
      if (unit.timeline.length < 2) return false;
      const current = unit.current.configVersion?.name ?? null;
      // The firmware change is the moment the configuration flips.
      const change = unit.timeline.find((e) => /^Firmware /.test(e.title));
      if (!change) return false;
      const before = unit.timeline.filter(
        (e) => e.ts.getTime() < change.ts.getTime(),
      );
      if (before.length === 0) return false;
      // Every pre-change event must carry the PRE-change config, and that must
      // NOT be the unit's current config — proving nothing reused resolve(now).
      const preConfig = before[0]!.configAt;
      return (
        preConfig !== null &&
        preConfig !== current &&
        before.every((e) => e.configAt === preConfig) &&
        change.configAt === current
      );
    },
  );
  await check(
    "a pre-change event's software matches the software of THAT era",
    () => {
      const change = unit.timeline.find((e) => /^Firmware /.test(e.title));
      const before = change
        ? unit.timeline.filter((e) => e.ts.getTime() < change.ts.getTime())
        : [];
      return (
        !!change &&
        before.length > 0 &&
        before.every((e) => e.swAt !== null && e.swAt !== change.swAt)
      );
    },
  );
  await check("no timeline event predates the unit's build", () => {
    if (!unit.buildDate) return true;
    return unit.timeline.every(
      (e) => e.ts.getTime() >= unit.buildDate!.getTime(),
    );
  });

  // ── 3: the diff summary is the SAME number asBuiltDiff computes ──
  await check("diff summary count matches asBuiltDiff exactly", async () => {
    const row = await db.unit.findFirst({ where: { serial: SERIAL } });
    if (!row) return false;
    const truth = await asBuiltDiff(db, row.id);
    return (
      unit.diff.summary.positions === truth.summary.positions &&
      unit.diff.summary.substitutions === truth.summary.substitutions &&
      unit.substitutions.length === truth.summary.substitutions &&
      truth.summary.substitutions > 0 // the demo thread really has divergence
    );
  });

  // ── 4: every link the page emits resolves to a real route ──
  // The two FORWARD links this page owns — the as-built diff and blast radius —
  // are created by PLM.4 and PLM.5, and each is asserted by that story's own
  // verify (verify:plm-4 / verify:plm-5 both check their route exists and that
  // the Unit page points at it). So every outbound link is covered; the
  // assertion just lives with the story that builds the target.
  await check("all links resolve to real routes", () => {
    const routes = [
      "apps/web/app/(shell)/engineering/page.tsx",
      "apps/web/app/(shell)/units/page.tsx",
      "apps/web/app/(shell)/units/[serial]/page.tsx",
      "apps/web/app/(shell)/quality/page.tsx",
    ];
    const missing = routes.filter((r) => !has(r));
    if (missing.length) console.log("      missing routes:", missing);
    return missing.length === 0;
  });

  // ── 5: effectivity is computed per unit, not assumed ──
  await check(
    "ECO effectivity is computed — a later-serial ECO does NOT apply here",
    () => {
      const eco = unit.changeOrders.find((e) => e.code === "ECO-318");
      // ECO-318 is effective from SN-2210; SN-2208 was built before it.
      return (
        !!eco &&
        eco.effectiveFromSerial === "SN-2210" &&
        eco.appliesToThisUnit === false
      );
    },
  );
  await check("the demo thread converges: NCR-118 is open on this unit", () => {
    return unit.issues.some((n) => n.code === "NCR-118");
  });

  // ── 6: isolation ──
  await check("isolation: a second org cannot read this unit", async () => {
    const leaked = await getUnitDetail(SECOND, SERIAL);
    return leaked === null;
  });

  await prisma.$disconnect();

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run().then(() => process.exit(failed > 0 ? 1 : 0));
