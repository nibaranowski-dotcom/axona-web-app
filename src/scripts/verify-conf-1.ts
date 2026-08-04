/**
 * Verify CONF.1 — calibrated confidence. Static checks + pure-function checks always
 * run; the fitted-model checks need the DB + demo seed (gated behind DATABASE_URL).
 * Run: pnpm verify:conf-1
 *
 *   1. CalibrationModel + MIN_SAMPLES in the schema; CalibrationModel in TENANT_MODELS;
 *      migration authored (table queryable).
 *   2. Calibration corrects overconfidence: a raw≈0.9 / ~60%-approved history fits a
 *      map where calibratedConfidence(0.9) ≈ 0.6 (materially below the raw).
 *   3. Honest cold start: below the sample floor → state "uncalibrated", value = raw.
 *   4. Monotonic: the fitted map is non-decreasing.
 *   5. Per-tenant isolation: a fresh org calibrates from ZERO of another org's data;
 *      the demo and isolation orgs have DIFFERENT models.
 *   6. Idempotent: re-running calibrate yields the same model for the same data.
 *   7. Surfaces render the calibrated value + uncalibrated state; data-driven (no
 *      hardcoded narrative).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fitCalibration, calibratedConfidence, MIN_SAMPLES } from "@axona/db";

const DEMO_ORG_ID = "org_axona_demo";
const SECOND_ORG_ID = "org_isolation_test";
const TEST_ORG_ID = "org_conf_coldstart_test";

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

// A synthetic over-confident history (deterministic — no DB): agents say ~0.9 but
// only ~60% are approved, plus lower bands, N well above the floor.
function overconfidentSamples(): { raw: number; approved: boolean }[] {
  const out: { raw: number; approved: boolean }[] = [];
  const band = (raw: number, rate: number, count: number) => {
    const approvals = Math.round(count * rate);
    for (let i = 0; i < count; i++)
      out.push({ raw: raw + ((i % 5) - 2) * 0.005, approved: i < approvals });
  };
  band(0.9, 0.6, 24);
  band(0.7, 0.55, 12);
  band(0.5, 0.45, 12);
  return out;
}

async function run(): Promise<void> {
  console.log("\nVerifying CONF.1 — calibrated confidence\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  // ── 1 (static): model + TENANT_MODELS ──
  const schema = read("packages/db/prisma/schema.prisma");
  const client = read("packages/db/src/client.ts");
  await check(
    "CalibrationModel model + @@unique([orgId,scope]) + in TENANT_MODELS",
    () => {
      const body =
        schema.match(/model CalibrationModel \{([\s\S]*?)\n\}/)?.[1] ?? "";
      const auditBody =
        schema.match(/model AuditLog \{([\s\S]*?)\n\}/)?.[1] ?? "";
      return (
        body.length > 0 &&
        /@@unique\(\[orgId, scope\]\)/.test(body) &&
        /sampleSize\s+Int/.test(body) &&
        /"CalibrationModel"/.test(client) && // TENANT_MODELS
        // no new CONF.1 column on the AuditLog model itself (reads the existing history)
        !/^\s+\w*calibrat\w*\s+\w/im.test(auditBody)
      );
    },
  );

  // ── 2 (pure): corrects overconfidence ──
  const fitted = fitCalibration(overconfidentSamples());
  await check(
    "corrects overconfidence: calibratedConfidence(0.9) is materially below 0.9 (~0.6)",
    () => {
      const c = calibratedConfidence(0.9, fitted);
      return (
        c.state === "calibrated" &&
        c.value < 0.7 && // materially below raw 0.9
        Math.abs(c.value - 0.6) <= 0.1 // ≈ the observed ~60%
      );
    },
  );

  // ── 3 (pure): honest cold start ──
  await check(
    "honest cold start: below the floor → uncalibrated, value = raw",
    () => {
      const tiny = fitCalibration(
        Array.from({ length: MIN_SAMPLES - 5 }, (_, i) => ({
          raw: 0.9,
          approved: i % 2 === 0,
        })),
      );
      const c = calibratedConfidence(0.9, tiny);
      const cNull = calibratedConfidence(0.9, null);
      return (
        c.state === "uncalibrated" &&
        c.value === 0.9 &&
        cNull.state === "uncalibrated" &&
        cNull.value === 0.9
      );
    },
  );

  // ── 4 (pure): monotonic ──
  await check("the fitted map is monotonic (non-decreasing)", () => {
    return fitted.bins.every((b, i, a) => i === 0 || b.rate >= a[i - 1]!.rate);
  });

  // ── 7 (static): surfaces + data-driven ──
  await check(
    "surfaces render calibrated value + uncalibrated state (data-driven)",
    () => {
      const audit = read("apps/web/components/audit/AuditView.tsx");
      const panel = read("apps/web/components/audit/ReliabilityPanel.tsx");
      const lib = read("apps/web/lib/audit-trail.ts");
      // HIST.1 extracted the confidence badge into audit-parts.tsx (shared by
      // AuditView + the RecordHistory timeline); the calibrated-value/uncal markup
      // now lives there. AuditView still renders it (via ConfidenceCell).
      const row =
        audit + "\n" + read("apps/web/components/audit/audit-parts.tsx");
      return (
        /calibratedConfidence/.test(lib) && // the read model applies calibration
        /e\.calibrated/.test(row) && // the row shows the calibrated value
        /uncalibrated|uncal/.test(row) && // cold-start marker
        /ConfidenceCell/.test(audit) && // AuditView delegates to the shared badge
        /calibration\.bins|calibration\?\.sampleSize|calibration\.ece/.test(
          panel,
        ) &&
        // no hardcoded demo narrative in the panel (PROSPECT.2 discipline)
        !/Tier-1 Auto OEM|SN-2196|AX-2|SERVO-20|Nomagic/.test(panel)
      );
    },
  );

  // ── DB checks (5, 6, table, seeded demo model) ──
  if (!process.env.DATABASE_URL) {
    console.log("  SKIP DB checks — DATABASE_URL not set");
    console.log(`\nPASSED — ${passed} checks (static + pure)`);
    return;
  }
  const { prisma, dbForOrg, calibrate, getCalibrationModel } =
    await import("@axona/db");

  await check(
    "CalibrationModel table queryable; demo model fitted (n≥20)",
    async () => {
      const m = await getCalibrationModel(DEMO_ORG_ID);
      return !!m && m.sampleSize >= MIN_SAMPLES;
    },
  );

  await check(
    "seeded demo model corrects its over-confidence (0.9 → materially lower)",
    async () => {
      const m = await getCalibrationModel(DEMO_ORG_ID);
      const c = calibratedConfidence(0.9, m);
      return c.state === "calibrated" && c.value < 0.75;
    },
  );

  await check(
    "idempotent: re-running calibrate yields the same model",
    async () => {
      // Catch up first: earlier verify scripts (rbac decide() tests) may append
      // decided proposals during verify:all, so compare two CONSECUTIVE refits on the
      // current audit state — not the seed-time model against a refit.
      const db = dbForOrg(DEMO_ORG_ID);
      await calibrate(db, DEMO_ORG_ID);
      const before = await getCalibrationModel(DEMO_ORG_ID);
      await calibrate(db, DEMO_ORG_ID);
      const after = await getCalibrationModel(DEMO_ORG_ID);
      return (
        before !== null &&
        after !== null &&
        before.sampleSize === after.sampleSize &&
        JSON.stringify(before.bins) === JSON.stringify(after.bins)
      );
    },
  );

  await check(
    "per-tenant isolation: demo and isolation orgs have DIFFERENT models",
    async () => {
      const demo = await getCalibrationModel(DEMO_ORG_ID);
      const iso = await getCalibrationModel(SECOND_ORG_ID);
      return (
        !!demo &&
        !!iso &&
        JSON.stringify(demo.bins) !== JSON.stringify(iso.bins) &&
        // the isolation org is under-confident (0.5 maps ABOVE 0.5) — its own outcomes
        calibratedConfidence(0.5, iso).value > 0.6
      );
    },
  );

  await check(
    "isolation: a fresh org calibrates from ZERO of another org's proposals",
    async () => {
      await prisma.org.upsert({
        where: { id: TEST_ORG_ID },
        update: {},
        create: { id: TEST_ORG_ID, name: "Conf Coldstart Test" },
      });
      const db = dbForOrg(TEST_ORG_ID);
      const res = await calibrate(db, TEST_ORG_ID);
      const m = await getCalibrationModel(TEST_ORG_ID);
      const isolated = res.sampleSize === 0; // saw none of the demo's 42 proposals
      const cold = calibratedConfidence(0.9, m).state === "uncalibrated";
      // self-clean
      await prisma.calibrationModel.deleteMany({
        where: { orgId: TEST_ORG_ID },
      });
      await prisma.org.delete({ where: { id: TEST_ORG_ID } }).catch(() => {});
      return isolated && cold;
    },
  );

  await prisma.$disconnect();

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run().then(() => process.exit(failed > 0 ? 1 : 0));
