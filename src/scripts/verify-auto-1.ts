/**
 * Verify AUTO.1 — Autonomy data/API. Static checks always run; data checks are
 * gated on DATABASE_URL. Run: pnpm verify:auto-1
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
const base = join(root, "apps/web");
const read = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");

async function run(): Promise<void> {
  console.log("\nVerifying AUTO.1 — Autonomy data/API\n");

  await check(
    "routes exist (metrics / incidents / policies)",
    () =>
      existsSync(join(base, "app/api/autonomy/metrics/route.ts")) &&
      existsSync(join(base, "app/api/autonomy/incidents/route.ts")) &&
      existsSync(join(base, "app/api/autonomy/policies/route.ts")),
  );

  const lib = read(join(base, "lib/autonomy.ts"));
  await check(
    "lib exists, org-scoped (dbForOrg) + paginated (FND.11)",
    () =>
      /getAutonomyData/.test(lib) &&
      /dbForOrg/.test(lib) &&
      /paginateArgs/.test(lib) &&
      /pageResult/.test(lib),
  );
  await check("read-only — no mutations", () => {
    const routes = ["metrics", "incidents", "policies"]
      .map((r) => read(join(base, `app/api/autonomy/${r}/route.ts`)))
      .join("\n");
    return !/\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\(/.test(
      lib + routes,
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

      await check("Site-3 series shows the p-13 canary regression", () => {
        const s = data.autonomySeries.find((x) => x.site === "Site-3");
        if (!s || s.points.length < 2 || !s.regression) return false;
        const first = s.points[0]!;
        const last = s.points[s.points.length - 1]!;
        // ts-ordered; autonomy dips + takeovers rise after p-13
        const ordered = s.points.every(
          (p, i) =>
            i === 0 ||
            new Date(p.ts).getTime() >= new Date(s.points[i - 1]!.ts).getTime(),
        );
        return (
          ordered &&
          last.autonomyRate < first.autonomyRate &&
          last.takeoversPer1k > first.takeoversPer1k &&
          s.points.some((p) => p.policyVersion === "p-13")
        );
      });
      await check("INC-201 present (near-miss, SN-2196, Site-3)", () =>
        data.safetyIncidents.some(
          (i) =>
            i.code === "INC-201" &&
            /near-miss/i.test(i.type) &&
            i.site === "Site-3",
        ),
      );
      await check("p-13 is in the canary state", () => {
        const p = data.policyVersions.find((x) => x.version === "p-13");
        return (
          !!p &&
          p.state.toLowerCase() === "canary" &&
          data.rollup.canaryVersion === "p-13"
        );
      });
      await check(
        "rollup (autonomy rate / takeovers / open incidents)",
        () =>
          data.rollup.avgAutonomyRate > 0 &&
          data.rollup.avgTakeoversPer1k > 0 &&
          data.rollup.openIncidents >= 1,
      );
      await check("org isolation — unknown org returns nothing", async () => {
        const empty = await getAutonomyData("org_does_not_exist");
        return (
          empty.autonomySeries.length === 0 &&
          empty.safetyIncidents.length === 0 &&
          empty.policyVersions.length === 0 &&
          empty.rollup.openIncidents === 0
        );
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
