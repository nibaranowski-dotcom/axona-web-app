/**
 * Verify SALES.2 — Sales & CRM screen. Static checks always run; data checks are
 * gated on DATABASE_URL. Run: pnpm verify:sales-2
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
  console.log("\nVerifying SALES.2 — Sales & CRM screen\n");

  await check(
    "route + components exist",
    () =>
      existsSync(join(base, "app/(shell)/sales/page.tsx")) &&
      ["SalesView", "PipelineFunnel", "ForecastPanel", "DealsTable"].every(
        (c) => existsSync(join(base, `components/sales/${c}.tsx`)),
      ),
  );

  await check("route renders getSalesData", () =>
    /getSalesData/.test(read(join(base, "app/(shell)/sales/page.tsx"))),
  );

  await check(
    "deals table binds the derived deliverability badge + reason",
    () => {
      const t = read(join(base, "components/sales/DealsTable.tsx"));
      return (
        /deliverability/.test(t) &&
        /deliverabilityReason/.test(t) &&
        /DELIVERABILITY/.test(t)
      );
    },
  );

  await check("funnel + forecast panels bind", () => {
    const pf = read(join(base, "components/sales/PipelineFunnel.tsx"));
    const fp = read(join(base, "components/sales/ForecastPanel.tsx"));
    return /StageCount/.test(pf) && /weightedForecast/.test(fp);
  });

  await check("CPQ / new-deal is agent-proposed (no live write)", () => {
    const all = readdirSync(join(base, "components/sales"))
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => read(join(base, "components/sales", f)))
      .join("\n");
    // no mutations anywhere; the New-deal CTA seeds the agent (proposes)
    return (
      !/\.(create|update|delete|upsert|updateMany|deleteMany)\(/.test(all) &&
      /setSeed\(/.test(read(join(base, "components/sales/SalesView.tsx")))
    );
  });

  await check("no red · no emoji · no raw hex in sales components", () => {
    const all = readdirSync(join(base, "components/sales"))
      .map((f) => read(join(base, "components/sales", f)))
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
    const { getSalesData } = await import("../../apps/web/lib/sales");
    const org = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const data = await getSalesData(org.id);
      await check(
        "funnel + forecast render full (5 stages, weighted < pipeline)",
        () => {
          return (
            data.rollup.funnel.length === 5 &&
            data.deals.length >= 5 &&
            data.rollup.weightedForecast > 0 &&
            data.rollup.weightedForecast < data.rollup.pipelineValue
          );
        },
      );
      await check(
        "Tier-1 Auto OEM deliverability AT_RISK resolves through FUL/MFG on-screen",
        () => {
          const bmw = data.deals.find((d) => d.account === "Tier-1 Auto OEM");
          // the DealsTable renders deliverabilityReason for AT_RISK deals
          return (
            !!bmw &&
            bmw.deliverability === "AT_RISK" &&
            !!bmw.deliverabilityReason &&
            /DLV|hold/i.test(bmw.deliverabilityReason)
          );
        },
      );
      await check(
        "deliverability spread has a mix (on-time / at-risk / other)",
        () => {
          const keys = new Set(data.deals.map((d) => d.deliverability));
          return keys.size >= 2 && keys.has("AT_RISK");
        },
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
