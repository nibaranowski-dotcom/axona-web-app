/**
 * Verify FUL.2 — Fulfillment screen. Static checks always run; data checks are
 * gated on DATABASE_URL. Run: pnpm verify:ful-2
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
  console.log("\nVerifying FUL.2 — Fulfillment screen\n");

  await check(
    "route + components exist",
    () =>
      existsSync(join(base, "app/(shell)/fulfillment/page.tsx")) &&
      [
        "FulfillmentView",
        "DeliveryPipeline",
        "DeliveryCard",
        "ShipmentPanel",
        "CommissioningPanel",
      ].every((c) => existsSync(join(base, `components/fulfillment/${c}.tsx`))),
  );

  await check("route renders getFulfillmentData", () =>
    /getFulfillmentData/.test(
      read(join(base, "app/(shell)/fulfillment/page.tsx")),
    ),
  );

  await check(
    "delivery pipeline is the signature artifact (7 stations)",
    () => {
      const t = read(join(base, "components/fulfillment/DeliveryCard.tsx"));
      return (
        /DELIVERY_STAGES/.test(t) &&
        /Customs/.test(t) &&
        /blocked/.test(t) &&
        /atRisk/.test(t)
      );
    },
  );

  await check(
    "read-only screen — no mutations in fulfillment components",
    () => {
      const all = readdirSync(join(base, "components/fulfillment"))
        .map((f) => read(join(base, "components/fulfillment", f)))
        .join("\n");
      return !/\.(create|update|delete|upsert|updateMany|deleteMany)\(/.test(
        all,
      );
    },
  );

  await check(
    "no red · no emoji · no raw hex in fulfillment components",
    () => {
      const all = readdirSync(join(base, "components/fulfillment"))
        .map((f) => read(join(base, "components/fulfillment", f)))
        .join("\n");
      return (
        !/\bred\b|#f00|ff0000/i.test(all) &&
        !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(all) &&
        !/#[0-9a-fA-F]{3,6}\b/.test(all)
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP data checks — DATABASE_URL not set");
  } else {
    const { prisma } = await import("@axona/db");
    const { getFulfillmentData } =
      await import("../../apps/web/lib/fulfillment");
    const org = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const data = await getFulfillmentData(org.id);
      await check(
        "DLV-3312 on the pipeline at CUSTOMS (EAR99, at-risk)",
        () => {
          const d = data.deliveries.find((x) => x.code === "DLV-3312");
          return (
            !!d &&
            d.stage === "CUSTOMS" &&
            d.atRisk &&
            /EAR99/i.test(d.riskState)
          );
        },
      );
      await check("pipeline is full — deliveries span ≥5 stages", () => {
        const stages = new Set(data.deliveries.map((d) => d.stage));
        return stages.size >= 5;
      });
      await check("a commissioning/on-site delivery exists for the panel", () =>
        data.deliveries.some(
          (d) => d.stage === "ONSITE" || d.stage === "COMMISSION",
        ),
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
