/**
 * Verify PLM.V4 — Fleet v2: config-aware. Run: pnpm verify:plm-v4
 *
 *   1. The live-units table gains a resolved "Config · SW" column and each unit
 *      links to its Unit page (PLM.3). The map + telemetry are kept (Fleet stays
 *      deployed-ops; the filterable registry is PLM.2 — not duplicated here).
 *   2. Config version + sw version are RESOLVED from the Unit spine, never the
 *      stored Robot.firmware scalar — the batch path AGREES with the single-unit
 *      resolveConfigAt the Unit page uses (they can never silently diverge).
 *   3. "Behind the latest release" (the "old" tag) is derived, not stored.
 *   4. Per-tenant isolation — a second org resolves nothing for these serials.
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
  console.log("\nVerifying PLM.V4 — Fleet v2 (config-aware)\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const page = read("apps/web/app/(shell)/fleet/page.tsx");
  const live = read("apps/web/components/fleet/LiveUnits.tsx");

  // ── static ──
  await check("fleet page resolves config summaries from the Unit spine", () =>
    /resolveConfigSummaries/.test(page),
  );
  await check(
    "live units show the resolved Config · SW column (not stored firmware)",
    () =>
      /Config · SW/.test(live) &&
      /configBySerial/.test(live) &&
      /configVersion/.test(live) &&
      /isBehind/.test(live),
  );
  await check("each unit links to /units/:serial (the Unit page)", () =>
    /href=\{`\/units\/\$\{encodeURIComponent\(r\.serial\)\}`\}/.test(live),
  );
  await check("map + telemetry kept (Fleet stays deployed-ops)", () => {
    const view = read("apps/web/components/fleet/FleetView.tsx");
    return (
      /DeploymentMap/.test(view) &&
      /polyline/.test(live) &&
      /telemetry/i.test(live)
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

  const { prisma } = await import("@axona/db");
  const { resolveConfigSummaries, resolveUnitConfigNow } =
    await import("../../apps/web/lib/units");

  const robots = await prisma.robot.findMany({
    where: { orgId: DEMO },
    select: { serial: true },
  });
  const serials = robots.map((r) => r.serial);
  const summaries = await resolveConfigSummaries(DEMO, serials);

  await check("config summaries resolve for the deployed fleet", () => {
    return (
      summaries.size > 0 &&
      [...summaries.values()].some((s) => s.swVersion !== null)
    );
  });

  // ── 2: the batch path AGREES with the single-unit spine resolve (resolved) ──
  await check(
    "SN-2208 Config · SW equals the Unit page's own resolveConfigAt",
    async () => {
      const summary = summaries.get(SERIAL);
      const resolved = await resolveUnitConfigNow(DEMO, SERIAL);
      if (!summary || !resolved) return false;
      return (
        summary.swVersion === (resolved.sw?.version ?? null) &&
        summary.configVersion === (resolved.configVersion?.name ?? null)
      );
    },
  );

  await check("'old' (behind latest) is derived across the fleet", () => {
    // at least one deployed unit is behind the latest firmware release — the
    // narrative's OTA rollout target. Derived from the software time-series.
    return [...summaries.values()].some((s) => s.isBehind === true);
  });

  // ── 4: isolation ──
  await check(
    "isolation: a second org resolves nothing for these serials",
    async () => {
      const other = await resolveConfigSummaries(SECOND, serials);
      return other.size === 0;
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
