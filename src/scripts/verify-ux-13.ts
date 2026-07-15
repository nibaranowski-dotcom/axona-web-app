/**
 * Verify UX.13 — table-surface consistency sweep (data rows on a white card).
 * Pure static check (no DB). Run: pnpm verify:ux-13
 *
 *   1. MachinesView AND MatrixView wrap their data tables in the canonical white
 *      card (overflow-hidden rounded-card border border-line bg-paper); rows sit on
 *      paper with border-t dividers + hover:bg-panel-2 — no transparent-on-panel
 *      data rows remain (the old bg-panel/border-b row surface is gone).
 *   2. The rest of the app's data tables already use the same card pattern (the
 *      sweep found no other offenders) — a regression guard over the canonical set.
 *   3. Non-table surfaces (chat/auth/shell) are untouched; PoRow + ExceptionFeed
 *      keep their intentional treatments; the two changed files use v2 tokens only
 *      (no raw hex, no invented reds, no emoji).
 */
import { readFileSync } from "node:fs";
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
const read = (p: string) => readFileSync(join(root, p), "utf8");
const C = "apps/web/components";

const CARD = /overflow-hidden rounded-card border border-line bg-paper/;
const ROW_ON_PAPER = /border-t border-line[^"`]*hover:bg-panel-2/;
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;
const RAW_HEX = /#[0-9a-fA-F]{3,8}\b/;
const RED_UTIL = /(text|bg|border|ring|decoration)-red-/;

function run(): void {
  console.log("\nVerifying UX.13 — table-surface consistency sweep\n");

  // ── 1. the two confirmed offenders, now on the canonical white card ──
  const machines = read(`${C}/machines/MachinesView.tsx`);
  check("MachinesView: register on a white card, rows on paper + hover", () => {
    return (
      CARD.test(machines) &&
      ROW_ON_PAPER.test(machines) &&
      // the table header is now on paper (was bg-panel)
      /border-b border-line bg-paper px-5 py-\[10px\]/.test(machines) &&
      // the old transparent-on-panel row surface is gone
      !/border-b border-line px-2 py-3/.test(machines) &&
      !/border-b border-line bg-panel px-6/.test(machines)
    );
  });

  const matrix = read(`${C}/matrix/MatrixView.tsx`);
  check(
    "MatrixView: file matrix on a white card, rows on paper + hover",
    () => {
      return (
        CARD.test(matrix) &&
        /border-t border-line[^"`]*hover:bg-panel-2/.test(matrix) &&
        // sticky header now on paper (was bg-panel)
        /sticky top-0 z-\[2\][^"]*bg-paper/.test(matrix) &&
        // the old transparent-on-panel row surface is gone
        !/border-b border-line px-6"/.test(matrix) &&
        !/bg-panel px-6 font-mono/.test(matrix)
      );
    },
  );

  // ── 2. regression guard: the canonical data tables stay on paper cards ──
  const CANONICAL: string[] = [
    "quality/NcrTable",
    "fleet/LiveUnits",
    "engineering/EcoTable",
    "sales/DealsTable",
    "procurement/PoQueue",
    "audit/AuditView",
    "settings/MembersView",
    "security/VulnerabilitiesTable",
    "field-service/WorkOrderQueue",
    "legal/MattersTable",
    "marketing/CampaignsTable",
    "inventory/InventoryView",
    "field-service/DispatchBoard",
    "manufacturing/BuildGenealogy",
    "autonomy/SafetyIncidents",
  ];
  check(
    "canonical data tables still sit on a bg-paper card (no other offenders)",
    () => {
      const misses = CANONICAL.filter(
        (f) =>
          !/rounded-card border border-line bg-paper/.test(
            read(`${C}/${f}.tsx`),
          ),
      );
      if (misses.length) console.log("      not on a paper card:", misses);
      return misses.length === 0;
    },
  );

  // ── 3. non-table surfaces untouched + tokens clean ──
  check(
    "PoRow + ExceptionFeed keep their intentional (non-swept) treatments",
    () => {
      const poRow = read(`${C}/procurement/PoRow.tsx`);
      const exFeed = read(`${C}/core/ExceptionFeed.tsx`);
      return (
        // PoRow is a row inside PoQueue's paper card — already canonical, unchanged
        /border-t border-line[^"`]*hover:bg-panel-2/.test(poRow) &&
        // ExceptionFeed renders per-item cards (not a shared-surface table)
        /ExceptionRow/.test(exFeed)
      );
    },
  );
  check("chat/auth/shell are not turned into data-table cards", () => {
    // these must NOT have gained the table-card wrapper
    const files = [
      "agents/ChatThread",
      "agents/Markdown",
      "shell/PaneChat",
      "shell/TracePane",
      "auth/OnboardingWizard",
    ];
    return files.every((f) => !CARD.test(read(`${C}/${f}.tsx`)));
  });
  check(
    "changed files: v2 tokens only — no raw hex / no reds / no emoji",
    () => {
      for (const src of [machines, matrix]) {
        if (RAW_HEX.test(src) || RED_UTIL.test(src) || EMOJI.test(src))
          return false;
      }
      return true;
    },
  );

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
