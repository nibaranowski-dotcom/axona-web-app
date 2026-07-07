/**
 * Verify UX.6 — members-table column alignment. Pure static/structural check (no DB).
 *   The roster header AND every member row must share ONE grid template whose
 *   actions column is a FIXED width (not `auto`) — so rows with a deactivate/revoke
 *   icon reserve the same actions slot as the header and the no-icon last-admin row,
 *   keeping Person · Role · Status · Last active aligned (same fix as UX.5's PoRow).
 * Run: pnpm verify:ux-6
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
  console.log("\nVerifying UX.6 — members-table column alignment\n");

  const members = read("components/settings/MembersView.tsx");

  check("MembersView defines ONE shared grid template (MEMBER_COLS)", () => {
    return /const MEMBER_COLS =\s*"grid grid-cols-\[[^\]]*\]/.test(members);
  });

  check("the shared actions column is a FIXED width (not `auto`)", () => {
    const m = members.match(
      /const MEMBER_COLS =\s*"grid grid-cols-\[([^\]]*)\]/,
    );
    const cols = m?.[1];
    if (!cols) return false;
    const last = cols.trim().split("_").pop() ?? "";
    return /^\d+px$/.test(last); // e.g. 44px — reserved identically on header + rows
  });

  check("no `auto`-terminated members grid template survives", () => {
    return !/grid-cols-\[[^\]]*_auto\]/.test(members);
  });

  check("the roster HEADER row uses the shared template", () => {
    // header is the mono uppercase label row
    return /\$\{MEMBER_COLS\}[^`"]*font-mono[^`"]*uppercase/.test(members);
  });

  check("every MEMBER ROW uses the same shared template", () => {
    // the row wrapper reuses MEMBER_COLS with items-center
    return /\$\{MEMBER_COLS\}\s+items-center/.test(members);
  });

  check("actions stay right-aligned within the fixed slot", () => {
    return /flex items-center justify-end/.test(members);
  });

  check("no invented reds / emoji in the touched component", () => {
    return (
      !/\bbg-red|text-red|border-red\b/.test(members) &&
      !/[\u{1F300}-\u{1FAFF}]/u.test(members)
    );
  });

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
