/**
 * Verify UX.1 — screen polish pass (pure static checks; no DB). Guards the three
 * layout fixes against regression. Run: pnpm verify:ux-1
 *  1. Shared <StatStrip> primitive exists with the load-bearing shrink-0.
 *  2. Every module View uses it (no inline 22px stat strip drifted back).
 *  3. TraceConsole no longer collapses/clips (shrink-0).
 *  4. /agents default-selects an agent on load (no empty placeholder).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
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

const root = process.cwd();
const comp = join(root, "apps/web/components");
const read = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");

// The module Views that carry the stat strip (the 12 card-strip screens).
const STAT_VIEWS = [
  "autonomy/AutonomyView",
  "finance/FinanceView",
  "field-service/FieldServiceView",
  "engineering/EngineeringView",
  "manufacturing/MfgView",
  "fulfillment/FulfillmentView",
  "legal/LegalView",
  "security/SecurityView",
  "marketing/MarketingView",
  "sales/SalesView",
  "people/PeopleView",
  "quality/QualityView",
];

console.log("\nVerifying UX.1 — screen polish pass\n");

const strip = read(join(comp, "shell/StatStrip.tsx"));
check(
  "StatStrip primitive exists with shrink-0 (fixes number clipping)",
  () => {
    return (
      /export function StatStrip/.test(strip) &&
      /shrink-0/.test(strip) &&
      /text-\[22px\] font-bold/.test(strip) &&
      /overflow-hidden/.test(strip)
    );
  },
);

check(
  "all 12 module Views use <StatStrip> (no inline strip drifted back)",
  () => {
    return STAT_VIEWS.every((v) => {
      const src = read(join(comp, `${v}.tsx`));
      const usesStatStrip =
        /<StatStrip stats=\{stats\}/.test(src) &&
        /from "@\/components\/shell\/StatStrip"/.test(src);
      // the old inline 22px strip must be gone from every View
      const noInlineStrip =
        !/text-\[22px\] font-bold tracking-\[-0\.03em\]/.test(src);
      return usesStatStrip && noInlineStrip;
    });
  },
);

check("no module View still hand-rolls the clipped inline strip", () => {
  const dirs = readdirSync(comp, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  for (const d of dirs) {
    for (const f of readdirSync(join(comp, d)).filter((f) =>
      /View\.tsx$/.test(f),
    )) {
      if (
        /text-\[22px\] font-bold tracking-\[-0\.03em\]/.test(
          read(join(comp, d, f)),
        )
      )
        return false;
    }
  }
  return true;
});

check("TraceConsole is shrink-0 (renders all lines; no bottom clip)", () => {
  const tc = read(join(comp, "shell/TraceConsole.tsx"));
  return /<section className="shrink-0 /.test(tc) && !/max-h/.test(tc);
});

check("/agents default-selects an agent on load (no empty placeholder)", () => {
  const av = read(join(comp, "agents/AgentsView.tsx"));
  return (
    /pickDefaultAgent/.test(av) &&
    /useState<AgentSummary \| null>\(\(\) =>/.test(av) &&
    /axona/i.test(av) &&
    // manual selection + needs-attention filter preserved
    /setSelected/.test(av) &&
    /needsAttention/.test(av)
  );
});

if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
else {
  console.log(`\nFAILED — ${failed} check(s) failed`);
  process.exit(1);
}
