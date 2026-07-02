/**
 * Verify FLEET.1 — Fleet data/API. Static checks always run; data checks are
 * gated on DATABASE_URL. Run: pnpm verify:fleet-1
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
  console.log("\nVerifying FLEET.1 — Fleet data/API\n");

  await check(
    "routes exist (robots / telemetry)",
    () =>
      existsSync(join(base, "app/api/fleet/robots/route.ts")) &&
      existsSync(join(base, "app/api/fleet/telemetry/route.ts")),
  );

  const lib = read(join(base, "lib/fleet.ts"));
  await check(
    "lib exists, org-scoped (dbForOrg) + paginated (FND.11)",
    () =>
      /getFleetData/.test(lib) &&
      /dbForOrg/.test(lib) &&
      /paginateArgs/.test(lib) &&
      /pageResult/.test(lib),
  );
  await check("read-only — no mutations", () => {
    const routes = ["robots", "telemetry"]
      .map((r) => read(join(base, `app/api/fleet/${r}/route.ts`)))
      .join("\n");
    return !/\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\(/.test(
      lib + routes,
    );
  });

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP data checks — DATABASE_URL not set");
  } else {
    const { prisma } = await import("@axona/db");
    const { getFleetData } = await import("../../apps/web/lib/fleet");
    const org = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const data = await getFleetData(org.id);

      await check("SN-2196 present as WATCH (HX-2, BMW, Site-3)", () => {
        const r = data.robots.find((x) => x.serial === "SN-2196");
        return (
          !!r &&
          r.status === "WATCH" &&
          r.alert === true &&
          r.model === "HX-2" &&
          r.customer === "BMW" &&
          r.site === "Site-3"
        );
      });
      await check("SN-2196 has a thermal telemetry series", () => {
        const s = data.telemetry.find(
          (t) => t.serial === "SN-2196" && /temp/i.test(t.metric),
        );
        return (
          !!s &&
          s.points.length >= 2 &&
          // ordered oldest → newest
          s.points.every(
            (p, i) =>
              i === 0 ||
              new Date(p.ts).getTime() >=
                new Date(s.points[i - 1]!.ts).getTime(),
          )
        );
      });
      await check("fleet rollup (avg uptime, byStatus, firmware)", () => {
        const r = data.rollup;
        return (
          r.total >= 1 &&
          r.avgUptimePct > 0 &&
          r.byStatus.length >= 1 &&
          r.firmware.length >= 1
        );
      });
      await check("predictive-alert list includes SN-2196", () =>
        data.alerts.some((a) => a.serial === "SN-2196"),
      );
      await check("org isolation — unknown org returns nothing", async () => {
        const empty = await getFleetData("org_does_not_exist");
        return (
          empty.robots.length === 0 &&
          empty.telemetry.length === 0 &&
          empty.alerts.length === 0 &&
          empty.rollup.total === 0
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
