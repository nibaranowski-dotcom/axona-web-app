/**
 * Verify MKT.2 — Marketing screen. Static checks always run; data checks are
 * gated on DATABASE_URL. Run: pnpm verify:mkt-2
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
  console.log("\nVerifying MKT.2 — Marketing screen\n");

  await check(
    "route + components exist",
    () =>
      existsSync(join(base, "app/(shell)/marketing/page.tsx")) &&
      [
        "MarketingView",
        "DemandFunnel",
        "ChannelAttribution",
        "CampaignsTable",
      ].every((c) => existsSync(join(base, `components/marketing/${c}.tsx`))),
  );

  await check("route renders getMarketingData", () =>
    /getMarketingData/.test(read(join(base, "app/(shell)/marketing/page.tsx"))),
  );

  await check("funnel + channel-attribution panels bind", () => {
    const df = read(join(base, "components/marketing/DemandFunnel.tsx"));
    const ca = read(join(base, "components/marketing/ChannelAttribution.tsx"));
    return (
      /DemandFunnel/.test(df) &&
      /ChannelAttribution/.test(ca) &&
      /dominant/.test(ca)
    );
  });

  await check("campaigns table binds the underperforming flag", () => {
    const t = read(join(base, "components/marketing/CampaignsTable.tsx"));
    return (
      /underperforming/.test(t) && /campaignStatus/.test(t) && /roi/.test(t)
    );
  });

  await check("read-only screen — no mutations in marketing components", () => {
    const all = readdirSync(join(base, "components/marketing"))
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => read(join(base, "components/marketing", f)))
      .join("\n");
    return (
      !/\.(create|update|delete|upsert|updateMany|deleteMany)\(/.test(all) &&
      /setSeed\(/.test(
        read(join(base, "components/marketing/MarketingView.tsx")),
      )
    );
  });

  await check("no red · no emoji · no raw hex in marketing components", () => {
    const all = readdirSync(join(base, "components/marketing"))
      .map((f) => read(join(base, "components/marketing", f)))
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
    const { getMarketingData } = await import("../../apps/web/lib/marketing");
    const org = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const data = await getMarketingData(org.id);
      await check("funnel + attribution render full", () => {
        return (
          data.rollup.funnel.mql > 0 &&
          data.rollup.attribution.length >= 3 &&
          data.campaigns.length >= 5
        );
      });
      await check("events reads dominant on-screen", () => {
        const events = data.rollup.attribution.find(
          (c) => c.channel === "events",
        );
        return !!events && events.dominant === true;
      });
      await check(
        "underperforming paid campaign flagged (ink, not red)",
        () => {
          const paid = data.campaigns.find((c) => c.name === "Paid search Q3");
          return (
            !!paid &&
            paid.underperforming === true &&
            data.rollup.underperforming >= 1
          );
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
