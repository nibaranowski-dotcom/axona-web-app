/**
 * Verify FUL.1 — Fulfillment data/API. Static checks always run; data checks are
 * gated on DATABASE_URL. Run: pnpm verify:ful-1
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
  console.log("\nVerifying FUL.1 — Fulfillment data/API\n");

  await check("route exists (deliveries)", () =>
    existsSync(join(base, "app/api/fulfillment/deliveries/route.ts")),
  );

  const lib = read(join(base, "lib/fulfillment.ts"));
  await check(
    "lib exists, org-scoped (dbForOrg) + paginated (FND.11)",
    () =>
      /getFulfillmentData/.test(lib) &&
      /dbForOrg/.test(lib) &&
      /paginateArgs/.test(lib) &&
      /pageResult/.test(lib),
  );
  await check("read-only — no mutations", () => {
    const routes = read(join(base, "app/api/fulfillment/deliveries/route.ts"));
    return !/\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\(/.test(
      lib + routes,
    );
  });

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

      await check("DLV-3312 in CUSTOMS with the EAR99 hold", () => {
        const d = data.deliveries.find((x) => x.code === "DLV-3312");
        return (
          !!d &&
          d.stage === "CUSTOMS" &&
          d.account === "BMW" &&
          /Osaka/.test(d.destination) &&
          /EAR99/i.test(d.riskState) &&
          d.atRisk === true
        );
      });
      await check(
        "stage pipeline rollup covers all 7 stages (ALLOC→ACTIVE)",
        () =>
          data.pipeline.length === 7 &&
          data.pipeline.map((s) => s.stage).join(",") ===
            "ALLOC,CRATE,FREIGHT,CUSTOMS,ONSITE,COMMISSION,ACTIVE" &&
          (data.pipeline.find((s) => s.stage === "CUSTOMS")?.count ?? 0) >= 1,
      );
      await check("holds list includes DLV-3312 (at-risk)", () =>
        data.holds.some((h) => h.code === "DLV-3312"),
      );
      await check("org isolation — unknown org returns nothing", async () => {
        const empty = await getFulfillmentData("org_does_not_exist");
        return (
          empty.deliveries.length === 0 &&
          empty.holds.length === 0 &&
          empty.pipeline.every((s) => s.count === 0)
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
