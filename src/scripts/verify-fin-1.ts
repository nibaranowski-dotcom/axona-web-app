/**
 * Verify FIN.1 — Finance data/API. Static checks always run; data checks are
 * gated on DATABASE_URL. Run: pnpm verify:fin-1
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
  console.log("\nVerifying FIN.1 — Finance data/API\n");

  await check(
    "routes exist (ledger / invoices / unit-economics)",
    () =>
      existsSync(join(base, "app/api/finance/ledger/route.ts")) &&
      existsSync(join(base, "app/api/finance/invoices/route.ts")) &&
      existsSync(join(base, "app/api/finance/unit-economics/route.ts")),
  );

  const lib = read(join(base, "lib/finance.ts"));
  await check(
    "lib exists, org-scoped (dbForOrg) + paginated (FND.11)",
    () =>
      /getFinanceData/.test(lib) &&
      /dbForOrg/.test(lib) &&
      /paginateArgs/.test(lib) &&
      /pageResult/.test(lib),
  );
  await check("read-only — no mutations", () => {
    const routes = ["ledger", "invoices", "unit-economics"]
      .map((r) => read(join(base, `app/api/finance/${r}/route.ts`)))
      .join("\n");
    return !/\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\(/.test(
      lib + routes,
    );
  });

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP data checks — DATABASE_URL not set");
  } else {
    const { prisma } = await import("@axona/db");
    const { getFinanceData } = await import("../../apps/web/lib/finance");
    const org = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const data = await getFinanceData(org.id);

      await check(
        "revenue split by kind — lumpy hardware vs ratable RaaS",
        () => {
          const rs = data.revenueSplit;
          return (
            rs.hardware > 0 &&
            rs.raas > 0 &&
            rs.total === rs.hardware + rs.raas &&
            rs.streams.some((s) => s.recognition === "lumpy") &&
            rs.streams.some((s) => s.recognition === "ratable")
          );
        },
      );
      await check("HX-2 unit economics — margin −2.1pt from ECO-318", () => {
        const u = data.unitEconomics.find((x) => x.product === "HX-2");
        return (
          !!u &&
          u.marginPct > 0 &&
          u.marginDeltaPt === -2.1 &&
          /ECO-318/.test(u.trend)
        );
      });
      await check("BMW net-60 present (current, not overdue)", () => {
        const inv = data.invoices.find((i) => i.account === "BMW");
        return (
          !!inv &&
          inv.terms === "net-60" &&
          inv.overdue === false &&
          inv.agingBucket === "current"
        );
      });
      await check("Kawasaki overdue with an AR-aging bucket", () => {
        const inv = data.invoices.find((i) => i.account === "Kawasaki");
        return (
          !!inv &&
          inv.overdue === true &&
          inv.daysOverdue > 0 &&
          inv.agingBucket !== "current" &&
          inv.agingBucket !== "paid"
        );
      });
      await check(
        "rollup (recognized revenue / AR + overdue; cash flagged)",
        () => {
          const r = data.rollup;
          return (
            r.recognizedRevenue > 0 &&
            r.arTotal > 0 &&
            r.arOverdue > 0 &&
            r.arOverdue <= r.arTotal &&
            r.cash === null &&
            r.runwayMonths === null
          );
        },
      );
      await check("org isolation — unknown org returns nothing", async () => {
        const empty = await getFinanceData("org_does_not_exist");
        return (
          empty.invoices.length === 0 &&
          empty.unitEconomics.length === 0 &&
          empty.revenueSplit.total === 0 &&
          empty.rollup.recognizedRevenue === 0
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
