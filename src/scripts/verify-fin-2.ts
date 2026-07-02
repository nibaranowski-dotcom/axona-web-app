/**
 * Verify FIN.2 — Finance screen. Static checks always run; data checks are gated
 * on DATABASE_URL. Run: pnpm verify:fin-2
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
  console.log("\nVerifying FIN.2 — Finance screen\n");

  await check(
    "route + components exist",
    () =>
      existsSync(join(base, "app/(shell)/finance/page.tsx")) &&
      [
        "FinanceView",
        "RevenueChart",
        "WorkingCapital",
        "UnitEconomics",
        "Receivables",
      ].every((c) => existsSync(join(base, `components/finance/${c}.tsx`))),
  );

  await check("route renders getFinanceData", () =>
    /getFinanceData/.test(read(join(base, "app/(shell)/finance/page.tsx"))),
  );

  await check("two-revenue-engine chart (hardware + RaaS) — signature", () => {
    const t = read(join(base, "components/finance/RevenueChart.tsx"));
    return /hardware/.test(t) && /raas/i.test(t) && /RevenuePeriod/.test(t);
  });

  await check("per-unit economics + AR-aging tables render", () => {
    const ue = read(join(base, "components/finance/UnitEconomics.tsx"));
    const ar = read(join(base, "components/finance/Receivables.tsx"));
    return (
      /marginPct/.test(ue) &&
      /marginDeltaPt/.test(ue) &&
      /agingLabel/.test(ar) &&
      /terms/.test(ar)
    );
  });

  await check("read-only screen — no mutations in finance components", () => {
    const all = readdirSync(join(base, "components/finance"))
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => read(join(base, "components/finance", f)))
      .join("\n");
    return !/\.(create|update|delete|upsert|updateMany|deleteMany)\(/.test(all);
  });

  await check("no red · no emoji · no raw hex in finance components", () => {
    const all = readdirSync(join(base, "components/finance"))
      .map((f) => read(join(base, "components/finance", f)))
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
    const { getFinanceData } = await import("../../apps/web/lib/finance");
    const org = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const data = await getFinanceData(org.id);
      await check("HX-2 −2.1pt + BMW net-60 + Kawasaki overdue surface", () => {
        const hx2 = data.unitEconomics.find((u) => u.product === "HX-2");
        const bmw = data.invoices.find((i) => i.account === "BMW");
        const kaw = data.invoices.find((i) => i.account === "Kawasaki");
        return (
          hx2?.marginDeltaPt === -2.1 &&
          bmw?.terms === "net-60" &&
          bmw.overdue === false &&
          kaw?.overdue === true
        );
      });
      await check(
        "revenue chart renders full — ≥6 periods, both engines",
        () => {
          const p = data.revenueByPeriod;
          return (
            p.length >= 6 &&
            p.every((x) => x.hardware > 0 && x.raas > 0) &&
            data.revenueSplit.hardware > 0 &&
            data.revenueSplit.raas > 0
          );
        },
      );
      await check("tables render full — ≥3 products, ≥3 invoices", () => {
        return data.unitEconomics.length >= 3 && data.invoices.length >= 3;
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
