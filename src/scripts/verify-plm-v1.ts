/**
 * Verify PLM.V1 — Engineering becomes the PLM hub. Run: pnpm verify:plm-v1
 * Static (structure only — no DB).
 *
 *   1. The entry-point band exists with links into every PLM surface: Unit registry
 *      (/units), Configurations (/configurations), Change orders (/changes/…),
 *      Test traceability (/tests).
 *   2. The band label is engineering-facing (configuration management + traceability)
 *      — NOT "PLM"/"ERP" as a headline (CRO copy guardrail).
 *   3. The existing artifacts are retained (EcoTable + CompatMatrix still rendered).
 *   4. (existing ENG verifies stay green — run by verify:all.)
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;
const check = (label: string, fn: () => boolean): void => {
  try {
    const ok = fn();
    console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
    ok ? passed++ : failed++;
  } catch (e) {
    console.log(`  FAIL ${label} — ${(e as Error).message}`);
    failed++;
  }
};

function run(): void {
  console.log("\nVerifying PLM.V1 — Engineering as the PLM hub\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";
  const view = read("apps/web/components/engineering/EngineeringView.tsx");

  check("entry-point band routes into every PLM surface", () => {
    return (
      /PlmHubBand/.test(view) &&
      /"\/units"/.test(view) &&
      /"\/configurations"/.test(view) &&
      /\/changes\//.test(view) &&
      /"\/tests"/.test(view)
    );
  });
  check(
    "band label is engineering-facing (no PLM/ERP headline — CRO guardrail)",
    () => {
      // the visible band label is the configuration-management phrasing (not a category
      // word), and the band's aria-label matches; ERP never appears.
      return (
        /Configuration management &amp; traceability/.test(view) &&
        /aria-label="Configuration management and traceability"/.test(view) &&
        !/\bERP\b/.test(view)
      );
    },
  );
  check("existing artifacts retained (EcoTable + CompatMatrix)", () => {
    return (
      /<EcoTable /.test(view) &&
      /<CompatMatrix /.test(view) &&
      existsSync(join(root, "apps/web/components/engineering/EcoTable.tsx")) &&
      existsSync(join(root, "apps/web/components/engineering/CompatMatrix.tsx"))
    );
  });
  check("v2 tokens only · no invented reds in the band", () => {
    return (
      !/#[0-9a-fA-F]{3,6}\b/.test(view) &&
      !/\bbg-red|text-red|border-red\b/.test(view)
    );
  });

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
