/**
 * Verify SALES.1 — Sales data/API. Static checks always run; data checks are
 * gated on DATABASE_URL. Run: pnpm verify:sales-1
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
  console.log("\nVerifying SALES.1 — Sales data/API\n");

  await check(
    "routes exist (deals / forecast)",
    () =>
      existsSync(join(base, "app/api/sales/deals/route.ts")) &&
      existsSync(join(base, "app/api/sales/forecast/route.ts")),
  );

  const lib = read(join(base, "lib/sales.ts"));
  await check(
    "lib exists, org-scoped (dbForOrg) + paginated (FND.11)",
    () =>
      /getSalesData/.test(lib) &&
      /listDeals/.test(lib) &&
      /dbForOrg/.test(lib) &&
      /paginateArgs/.test(lib) &&
      /pageResult/.test(lib),
  );
  await check(
    "deliverability composes over FUL.1 + MFG.1 (reuses libs)",
    () =>
      /from "\.\/fulfillment"/.test(lib) &&
      /from "\.\/manufacturing"/.test(lib),
  );
  await check(
    "moat: RBAC.4 + AUDIT.3 seams, agent-drafted only",
    () => /RBAC\.4/.test(lib) && /AUDIT\.3/.test(lib),
  );
  await check("read-only — no mutations", () => {
    const routes = ["deals", "forecast"]
      .map((r) => read(join(base, `app/api/sales/${r}/route.ts`)))
      .join("\n");
    return !/\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\(/.test(
      lib + routes,
    );
  });

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP data checks — DATABASE_URL not set");
  } else {
    const { prisma } = await import("@axona/db");
    const { getSalesData, listDeals } =
      await import("../../apps/web/lib/sales");
    const org = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const data = await getSalesData(org.id);

      await check("funnel binds across all 5 stages", () => {
        const f = data.rollup.funnel;
        const stages = f.map((s) => s.stage);
        return (
          f.length === 5 &&
          ["QUALIFY", "DEMO", "PROPOSAL", "NEGOTIATION", "COMMIT"].every((s) =>
            stages.includes(s as never),
          ) &&
          f.reduce((n, s) => n + s.count, 0) === data.deals.length
        );
      });
      await check("weighted forecast + pipeline value bind", () => {
        const r = data.rollup;
        return (
          r.pipelineValue > 0 &&
          r.weightedForecast > 0 &&
          r.weightedForecast < r.pipelineValue &&
          data.deals.every((d) => d.weightedValue > 0)
        );
      });
      await check(
        "Tier-1 Auto OEM deliverability resolves AT_RISK through FUL + MFG",
        () => {
          const bmw = data.deals.find((d) => d.account === "Tier-1 Auto OEM");
          return (
            !!bmw &&
            bmw.deliverability === "AT_RISK" &&
            !!bmw.deliverabilityReason &&
            /DLV|hold/i.test(bmw.deliverabilityReason)
          );
        },
      );
      await check("deliverability spread + at-risk count bind", () => {
        const r = data.rollup;
        return (
          r.deliverabilitySpread.length >= 2 &&
          r.atRisk >= 1 &&
          r.deliverabilitySpread.reduce((n, s) => n + s.count, 0) ===
            data.deals.length
        );
      });
      await check("listDeals paginates + filters by stage", async () => {
        const page = await listDeals(org.id, { take: 3 });
        const commit = await listDeals(org.id, { stage: "COMMIT" });
        return (
          page.items.length <= 3 &&
          "nextCursor" in page &&
          commit.items.every((d) => d.stage === "COMMIT") &&
          commit.items.length >= 1
        );
      });
      await check("org isolation — unknown org returns nothing", async () => {
        const empty = await getSalesData("org_does_not_exist");
        return empty.deals.length === 0 && empty.rollup.pipelineValue === 0;
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
