/**
 * Verify MKT.1 — Marketing data/API. Static checks always run; data checks are
 * gated on DATABASE_URL. Run: pnpm verify:mkt-1
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
  console.log("\nVerifying MKT.1 — Marketing data/API\n");

  await check(
    "routes exist (campaigns / funnel)",
    () =>
      existsSync(join(base, "app/api/marketing/campaigns/route.ts")) &&
      existsSync(join(base, "app/api/marketing/funnel/route.ts")),
  );

  const lib = read(join(base, "lib/marketing.ts"));
  await check(
    "lib exists, org-scoped (dbForOrg) + paginated (FND.11)",
    () =>
      /getMarketingData/.test(lib) &&
      /listCampaigns/.test(lib) &&
      /dbForOrg/.test(lib) &&
      /paginateArgs/.test(lib) &&
      /pageResult/.test(lib),
  );
  await check(
    "attribution reconciles to SALES.1 (reuses getSalesData)",
    () => /from "\.\/sales"/.test(lib) && /getSalesData/.test(lib),
  );
  await check(
    "moat: RBAC.4 + AUDIT.3 seams, agent-drafted only",
    () => /RBAC\.4/.test(lib) && /AUDIT\.3/.test(lib),
  );
  await check("read-only — no mutations", () => {
    const routes = ["campaigns", "funnel"]
      .map((r) => read(join(base, `app/api/marketing/${r}/route.ts`)))
      .join("\n");
    return !/\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\(/.test(
      lib + routes,
    );
  });

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP data checks — DATABASE_URL not set");
  } else {
    const { prisma } = await import("@axona/db");
    const { getMarketingData, listCampaigns } =
      await import("../../apps/web/lib/marketing");
    const org = await prisma.org.findFirst({
      where: { name: "Axona" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const data = await getMarketingData(org.id);

      await check("demand funnel binds (leads→MQL→SQL→pipeline)", () => {
        const f = data.rollup.funnel;
        return (
          f.leads > f.mql &&
          f.mql > 0 &&
          f.sql > 0 &&
          f.pipeline > 0 &&
          f.mql >= f.sql
        );
      });
      await check("events channel reads dominant in attribution", () => {
        const a = data.rollup.attribution;
        const events = a.find((x) => x.channel === "events");
        return (
          a.length >= 3 &&
          !!events &&
          events.dominant === true &&
          a.reduce((n, x) => n + x.pipeline, 0) === data.rollup.sourcedPipeline
        );
      });
      await check(
        "attribution reconciles to Sales pipeline (coverage %)",
        () => {
          const r = data.rollup;
          return (
            r.salesPipeline > 0 &&
            r.sourcedPipeline > 0 &&
            r.attributionCoveragePct > 0 &&
            r.attributionCoveragePct ===
              Math.round((r.sourcedPipeline / r.salesPipeline) * 100)
          );
        },
      );
      await check("underperforming paid campaign is flagged", () => {
        const paid = data.campaigns.find((c) => c.name === "Paid search Q3");
        return (
          !!paid &&
          paid.channel === "paid" &&
          paid.underperforming === true &&
          data.rollup.underperforming >= 1
        );
      });
      await check("listCampaigns paginates + filters by channel", async () => {
        const page = await listCampaigns(org.id, { take: 3 });
        const events = await listCampaigns(org.id, { channel: "events" });
        return (
          page.items.length <= 3 &&
          "nextCursor" in page &&
          events.items.every((c) => c.channel === "events") &&
          events.items.length >= 2
        );
      });
      await check("org isolation — unknown org returns nothing", async () => {
        const empty = await getMarketingData("org_does_not_exist");
        return (
          empty.campaigns.length === 0 && empty.rollup.sourcedPipeline === 0
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
