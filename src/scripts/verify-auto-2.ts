/**
 * Verify AUTO.2 — Autonomy screen. Static checks always run; data checks are
 * gated on DATABASE_URL. Run: pnpm verify:auto-2
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
const base = join(root, "apps/web");
const read = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");

async function run(): Promise<void> {
  console.log("\nVerifying AUTO.2 — Autonomy screen\n");

  await check(
    "route + components exist",
    () =>
      existsSync(join(base, "app/(shell)/autonomy/page.tsx")) &&
      ["AutonomyView", "AutonomyTrend", "PolicyPanel", "SafetyIncidents"].every(
        (c) => existsSync(join(base, `components/autonomy/${c}.tsx`)),
      ),
  );

  await check("route renders getAutonomyData", () =>
    /getAutonomyData/.test(read(join(base, "app/(shell)/autonomy/page.tsx"))),
  );

  await check(
    "autonomy-rate trend (signature) highlights the p-13 cohort",
    () => {
      const t = read(join(base, "components/autonomy/AutonomyTrend.tsx"));
      return /autonomyRate/.test(t) && /p-13/.test(t) && /regression/.test(t);
    },
  );

  const actions = read(join(base, "app/(shell)/autonomy/actions.ts"));
  await check(
    "advancePolicy: requireRole FIRST, org-scoped, revalidates, AUDIT.3 seam",
    () =>
      /requireRole\(user, \["ENGINEER", "ADMIN"\]\)/.test(actions) &&
      /dbForOrg/.test(actions) &&
      /revalidatePath/.test(actions) &&
      /AUDIT\.3/.test(actions) &&
      actions.indexOf("requireRole(") < actions.indexOf("dbForOrg("),
  );
  await check("policy promote/rollback is role-gated in the UI", () => {
    const t = read(join(base, "components/autonomy/PolicyPanel.tsx"));
    return /canManage/.test(t) && /advancePolicy/.test(t) && /Rollback/.test(t);
  });

  await check("no red · no emoji · no raw hex in autonomy components", () => {
    const all = readdirSync(join(base, "components/autonomy"))
      .map((f) => read(join(base, "components/autonomy", f)))
      .join("\n");
    return (
      !/\bred\b|#f00|ff0000/i.test(all) &&
      !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(all) &&
      !/#[0-9a-fA-F]{3,6}\b/.test(all)
    );
  });

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP data checks — DATABASE_URL not set");
  } else {
    const { prisma } = await import("@axona/db");
    const { getAutonomyData } = await import("../../apps/web/lib/autonomy");
    const org = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const data = await getAutonomyData(org.id);
      await check("Site-3 regression series present for the trend", () =>
        data.autonomySeries.some((s) => s.site === "Site-3" && s.regression),
      );
      await check(
        "p-13 canary + INC-201 render",
        () =>
          data.policyVersions.some(
            (p) => p.version === "p-13" && p.state.toLowerCase() === "canary",
          ) && data.safetyIncidents.some((i) => i.code === "INC-201"),
      );
      await check(
        "renders full — ≥2 site series, ≥3 incidents",
        () =>
          data.autonomySeries.length >= 2 && data.safetyIncidents.length >= 3,
      );
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
