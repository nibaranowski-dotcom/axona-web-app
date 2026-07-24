/**
 * Verify PLM.V6 — Inventory v2: part master + lot traceability (`Inventory.dc.html`).
 * Run: pnpm verify:plm-v6
 *
 *   1. Route + view keep the existing inventory picture; the new Part master · lot
 *      traceability region renders (category · vendors · lifecycle · lot · units).
 *   2. Lot → units resolves through the SAME façade PLM.5's blast radius uses
 *      (affectedUnits({ lot })) — lot 88421 → the affected units, one source of truth.
 *   3. Part master attributes (lifecycle · approved vendors · category) are real.
 *   4. Per-tenant isolation.
 *   5. Existing INV verifies stay green (checked by verify:all).
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

const DEMO = "org_axona_demo";
const SECOND = "org_isolation_test";
const LOT = "88421";

async function run(): Promise<void> {
  console.log(
    "\nVerifying PLM.V6 — Inventory v2 (part master + lot traceability)\n",
  );
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const view = read("apps/web/components/inventory/InventoryView.tsx");
  const lib = read("apps/web/lib/inventory.ts");

  // ── static ──
  await check(
    "existing inventory picture kept (stock · critical parts)",
    () => {
      return (
        /Stock by location/.test(view) &&
        /Critical parts/.test(view) &&
        /Field edge caches/.test(view)
      );
    },
  );
  await check("Part master · lot traceability region added", () => {
    return (
      /Part master · lot traceability/.test(view) &&
      /lot → units/.test(view) &&
      /Lifecycle/.test(view) &&
      /In units/.test(view)
    );
  });
  await check("lot → units resolves through the affectedUnits façade", () => {
    return (
      /import \{ affectedUnits \} from "@axona\/agents"/.test(lib) &&
      /affectedUnits\(db, \{ lot \}\)/.test(lib)
    );
  });
  await check("rows link to /blast-radius to trace the lot", () => {
    return (
      /\/blast-radius\?type=lot&value=/.test(lib) && /blastHref/.test(view)
    );
  });
  await check("v2 tokens only · no invented reds in the region", () => {
    // scan just the PLM.V6 region markup for raw hex / red utilities
    const region = view.slice(view.indexOf("Part master · lot traceability"));
    return (
      !/#[0-9a-fA-F]{3,6}\b/.test(region) &&
      !/\bbg-red|text-red|border-red\b/.test(region)
    );
  });

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP data checks — DATABASE_URL not set");
    if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
    else {
      console.log(`\nFAILED — ${failed} check(s) failed`);
      process.exit(1);
    }
    return;
  }

  const { prisma, dbForOrg } = await import("@axona/db");
  const { affectedUnits } = await import("@axona/agents");
  const { listPartMasterTrace } = await import("../../apps/web/lib/inventory");

  const rows = await listPartMasterTrace(DEMO);

  // ── 1 + 3: the table is populated with real part-master attributes ──
  await check(
    "part master rows render with lifecycle · vendors · category",
    () => {
      return (
        rows.length >= 3 &&
        rows.every((r) => !!r.lifecycle && !!r.category) &&
        rows.some((r) => r.vendors !== "—") &&
        rows.some((r) => /approved/.test(r.vendors)) // a multi-vendor part
      );
    },
  );

  // ── 2: lot 88421 → the SAME units the blast-radius façade returns ──
  const servoRow = rows.find((r) => r.partNumber === "SERVO-204");
  await check("SERVO-204 carries the quarantined lot 88421", () => {
    return (
      !!servoRow && servoRow.lot === LOT && servoRow.lotQuarantine === true
    );
  });

  await check(
    "lot 88421 → units matches affectedUnits({ lot }) exactly (PLM.5's façade)",
    async () => {
      const db = dbForOrg(DEMO);
      const facade = await affectedUnits(db, { lot: LOT });
      const expected = facade.units.length;
      return (
        expected > 0 &&
        !!servoRow &&
        servoRow.unitsInField === expected &&
        // the demo thread's cohort — HX2-0208 / HX2-0214 carry lot 88421
        facade.units.some((u) => u.serial === "HX2-0208")
      );
    },
  );

  // ── 4: isolation ──
  await check(
    "isolation: a second org resolves no lot-88421 units",
    async () => {
      const other = dbForOrg(SECOND);
      const facade = await affectedUnits(other, { lot: LOT });
      return facade.units.length === 0;
    },
  );

  await prisma.$disconnect();

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run().then(() => process.exit(failed > 0 ? 1 : 0));
