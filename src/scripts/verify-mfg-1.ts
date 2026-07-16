/**
 * Verify MFG.1 — Manufacturing data/API. Static checks always run; data checks
 * are gated on DATABASE_URL. Run: pnpm verify:mfg-1
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
  console.log("\nVerifying MFG.1 — Manufacturing data/API\n");

  await check(
    "routes exist (work-orders / genealogy)",
    () =>
      existsSync(join(base, "app/api/manufacturing/work-orders/route.ts")) &&
      existsSync(join(base, "app/api/manufacturing/genealogy/route.ts")),
  );

  const lib = read(join(base, "lib/manufacturing.ts"));
  await check(
    "lib exists, org-scoped (dbForOrg) + paginated (FND.11)",
    () =>
      /getManufacturingData/.test(lib) &&
      /getGenealogy/.test(lib) &&
      /dbForOrg/.test(lib) &&
      /paginateArgs/.test(lib) &&
      /pageResult/.test(lib),
  );
  await check(
    "moat: ONT.2 pointer + as-built (never reconstructed)",
    () =>
      /ONT\.2/.test(lib) &&
      /as[- ]built/i.test(lib) &&
      /reconstruct/i.test(lib),
  );
  await check("read-only — no mutations", () => {
    const routes = ["work-orders", "genealogy"]
      .map((r) => read(join(base, `app/api/manufacturing/${r}/route.ts`)))
      .join("\n");
    return !/\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\(/.test(
      lib + routes,
    );
  });

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP data checks — DATABASE_URL not set");
  } else {
    const { prisma } = await import("@axona/db");
    const { getManufacturingData, getGenealogy } =
      await import("../../apps/web/lib/manufacturing");
    const org = await prisma.org.findFirst({
      where: { name: "Axona" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const data = await getManufacturingData(org.id);

      await check("lineFlow grouped by station, in build order", () => {
        const lf = data.lineFlow;
        if (lf.length < 2) return false;
        const ordered = lf.every(
          (s, i) => i === 0 || s.order >= lf[i - 1]!.order,
        );
        return (
          ordered &&
          lf.every(
            (s) =>
              typeof s.count === "number" &&
              s.count === s.workOrders.length &&
              typeof s.inProgress === "number",
          )
        );
      });
      await check("throughput (built / in-progress; OEE flagged null)", () => {
        const t = data.throughput;
        return (
          typeof t.built === "number" &&
          typeof t.inProgress === "number" &&
          t.total >= 3 &&
          t.oeePct === null
        );
      });
      await check(
        "bottlenecks — stations by in-progress backlog",
        () =>
          Array.isArray(data.bottlenecks) &&
          data.bottlenecks.every((b) => typeof b.inProgress === "number") &&
          data.bottlenecks.every(
            (b, i) =>
              i === 0 || b.inProgress <= data.bottlenecks[i - 1]!.inProgress,
          ),
      );

      // genealogy — a real serial's ordered build trace (anchor = serial)
      const anySerial = data.lineFlow[0]?.workOrders[0]?.serial;
      await check(
        "getGenealogy returns a per-serial ordered trace",
        async () => {
          if (!anySerial) return false;
          const g = await getGenealogy(org.id, anySerial);
          return (
            g.serial === anySerial &&
            g.steps.length >= 1 &&
            g.steps.every((s) => s.serial === anySerial && !!s.station) &&
            g.steps.every((s, i) => i === 0 || s.order >= g.steps[i - 1]!.order)
          );
        },
      );

      await check("org isolation — unknown org returns nothing", async () => {
        const empty = await getManufacturingData("org_does_not_exist");
        const g = await getGenealogy("org_does_not_exist", anySerial ?? "x");
        return (
          empty.lineFlow.length === 0 &&
          empty.throughput.total === 0 &&
          g.steps.length === 0
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
