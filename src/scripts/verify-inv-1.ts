/**
 * Verify INV.1 — Inventory data/API. Static checks always run; data checks are
 * gated on DATABASE_URL. Run: pnpm verify:inv-1
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
  console.log("\nVerifying INV.1 — Inventory data/API\n");

  await check(
    "lib + api routes exist",
    () =>
      existsSync(join(base, "lib/inventory.ts")) &&
      existsSync(join(base, "app/api/inventory/route.ts")) &&
      existsSync(join(base, "app/api/inventory/summary/route.ts")),
  );

  const lib = read(join(base, "lib/inventory.ts"));
  await check(
    "org-scoped (dbForOrg) + paginated (FND.11) + read-only (no mutations)",
    () =>
      /getInventoryData/.test(lib) &&
      /listInventory/.test(lib) &&
      /dbForOrg/.test(lib) &&
      /paginateArgs/.test(lib) &&
      /pageResult/.test(lib) &&
      !/\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\(/.test(
        lib,
      ),
  );
  await check(
    "moat: RBAC.4 + AUDIT.3 seams",
    () => /RBAC\.4/.test(lib) && /AUDIT\.3/.test(lib),
  );
  await check("days-of-cover is a LABELLED stand-in (Part.dailyUse)", () => {
    const schema = read(join(root, "packages/db/prisma/schema.prisma"));
    return (
      /STAND-IN/i.test(lib) &&
      /dailyUse/.test(lib) &&
      /dailyUse/.test(schema) &&
      /STAND-IN/i.test(schema)
    );
  });

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP data checks — DATABASE_URL not set");
  } else {
    const { prisma } = await import("@axona/db");
    const { getInventoryData, listInventory } =
      await import("../../apps/web/lib/inventory");
    const org = await prisma.org.findFirst({
      where: { name: "Axona" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const data = await getInventoryData(org.id);

      await check(
        "stock-by-location across kinds (edge caches + finished goods)",
        () => {
          const kinds = new Set(data.stockByLocation.map((l) => l.kind));
          return (
            data.stockByLocation.length >= 3 &&
            kinds.has("EDGE_CACHE") &&
            kinds.has("FINISHED_GOODS") &&
            data.stockByLocation.every((l) => l.valueUsd >= 0 && "pct" in l) &&
            data.rollup.totalValueUsd > 0
          );
        },
      );
      await check(
        "critical parts carry days-of-cover + reserved + status",
        () => {
          const p = data.criticalParts;
          return (
            p.length >= 4 &&
            p.every(
              (x) =>
                typeof x.daysOfCover === "number" &&
                typeof x.reserved === "number" &&
                ["REORDER", "WATCH", "QUARANTINE", "HEALTHY"].includes(
                  x.status,
                ),
            ) &&
            p.some((x) => x.status === "WATCH") &&
            // finished units are excluded from the build-parts table
            p.every((x) => !/-UNIT$/i.test(x.sku))
          );
        },
      );
      await check(
        "reorder-needed part ties to an incoming Procurement PO",
        () => {
          const reorder = data.criticalParts.filter((p) => p.reorderNeeded);
          return (
            reorder.length >= 1 &&
            reorder.some(
              (p) => p.incomingPo != null && /^PO-/.test(p.incomingPo.code),
            ) &&
            data.rollup.reorderNeeded === reorder.length
          );
        },
      );
      await check(
        "spares-near-fleet + reserved totals bind; Osaka below-min",
        () => {
          const osaka = data.edgeCaches.find((e) => /Osaka/i.test(e.location));
          return (
            data.rollup.sparesNearFleet > 0 &&
            data.rollup.reservedTotal > 0 &&
            !!osaka &&
            osaka.belowMin &&
            osaka.state === "REPLENISH"
          );
        },
      );
      await check("listInventory paginates + filters by location", async () => {
        const page = await listInventory(org.id, { take: 3 });
        const osaka = await listInventory(org.id, { location: "Osaka" });
        return (
          page.items.length <= 3 &&
          "nextCursor" in page &&
          osaka.items.every((s) => s.location === "Osaka") &&
          osaka.items.length >= 1
        );
      });
      await check("org isolation — unknown org returns nothing", async () => {
        const empty = await getInventoryData("org_does_not_exist");
        return (
          empty.criticalParts.length === 0 &&
          empty.stockByLocation.length === 0 &&
          empty.rollup.totalValueUsd === 0
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
