/**
 * Verify UX.5 — two UI bugs. Pure static/structural checks (no DB).
 *   BUG 1 (/audit): the sticky column header pins cleanly (the region is not an
 *     overflow scroll container that would trap it; raised z-index; opaque topbar
 *     covers 0→60).
 *   BUG 2 (/procurement): one shared grid template with a FIXED-width actions
 *     column across the header AND every row, so data columns align.
 * Run: pnpm verify:ux-5
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

const web = join(process.cwd(), "apps/web");
const read = (p: string) =>
  existsSync(join(web, p)) ? readFileSync(join(web, p), "utf8") : "";

function run(): void {
  console.log(
    "\nVerifying UX.5 — audit sticky-header bleed · procurement alignment\n",
  );

  const audit = read("components/audit/AuditView.tsx");

  // --- BUG 1: /audit pinned header pins cleanly (AUDIT.4 rebuilt this screen to
  //     the v8 day-grouped design: the pinned element is now the filter bar, not a
  //     column header; the guarantee is unchanged — it pins below the topbar
  //     against the shell's <main> scroll, nothing traps it, rows stay responsive) ---
  check(
    "audit view has NO inner overflow scroll container (nothing traps the pinned bar)",
    () => {
      // The whole screen scrolls via ScreenShell's <main>; the audit view must not
      // introduce its own overflow-y/x scroll container (which would trap sticky).
      return !/overflow-(x-|y-)?auto|overflow-scroll/.test(audit);
    },
  );
  check(
    "audit filter bar is sticky top-[60px] with a raised z-index + opaque bg",
    () => {
      const m = audit.match(
        /sticky top-\[60px\] z-\[(\d+)\][^`"]*bg-(panel|paper)/,
      );
      return !!m && Number(m[1]) >= 10; // above the scrolling rows (z-0)
    },
  );
  check(
    "audit rows use a responsive grid template (minmax, no fixed min-width column)",
    () => {
      // The ROW template drives the columns — it must be responsive (minmax) and
      // carry no `min-w-[Npx]` that would force a horizontal scroll.
      const rowTpl = audit.match(/const ROW =\s*\n?\s*"([^"]*)"/)?.[1] ?? "";
      return /minmax\(/.test(rowTpl) && !/min-w-\[\d+px\]/.test(rowTpl);
    },
  );

  // --- the ScreenShell topbar covers 0→60 opaquely, above the pinned header ---
  const shell = read("components/shell/ScreenShell.tsx");
  check(
    "ScreenShell topbar is sticky top-0, opaque (bg-paper), above the pinned header (z-20)",
    () => {
      return /sticky top-0 z-20[^`"]*bg-paper/.test(shell);
    },
  );

  // --- BUG 2: /procurement one shared grid template, fixed actions column ---
  const poRow = read("components/procurement/PoRow.tsx");
  check("PoRow grid reserves a FIXED-width actions column (not `auto`)", () => {
    const m = poRow.match(/const COLS =\s*\n?\s*"grid grid-cols-\[([^\]]*)\]/);
    const cols = m?.[1];
    if (!cols) return false;
    const last = cols.trim().split("_").pop() ?? "";
    return /^\d+px$/.test(last); // e.g. 160px — reserved on every row
  });
  check(
    "the PO header uses the identical template (PO_HEADER_COLS = COLS)",
    () => {
      return /export const PO_HEADER_COLS = COLS;/.test(poRow);
    },
  );
  check("no invented reds / emoji in the touched components", () => {
    const t = audit + poRow;
    return (
      !/\bbg-red|text-red|border-red\b/.test(t) &&
      !/[\u{1F300}-\u{1FAFF}]/u.test(t)
    );
  });

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
