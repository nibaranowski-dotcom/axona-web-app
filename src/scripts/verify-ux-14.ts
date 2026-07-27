/**
 * Verify UX.14 — the collapsed sidebar keeps icon-only module nav. Run: pnpm verify:ux-14
 *
 * Pure UI (client state via useUi.sidebarCollapsed), so the checks are static over
 * Sidebar.tsx + module-icons.tsx, scoped to the COLLAPSED branch:
 *   1. The collapsed rail renders a nav item PER VISIBLE MODULE (Lucide icon +
 *      aria-label + hover title) — not just logo + expand + search.
 *   2. The active module is indicated (isNavItemActive + the expanded nav's fill).
 *   3. Per-module alert counts are preserved as a small accent dot (no invented red).
 *   4. The identity/UX.7 menu + search + expand toggle are reachable when collapsed.
 *   5. The expanded nav is unchanged (still renders NavSection).
 *   6. Every module key has a sensible Lucide icon (with a neutral fallback).
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
  console.log("\nVerifying UX.14 — collapsed sidebar icon-only module nav\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const sidebar = read("apps/web/components/shell/Sidebar.tsx");
  const icons = read("apps/web/components/shell/module-icons.tsx");

  // The collapsed branch = from `if (mounted && collapsed)` to the expanded `return (`.
  const start = sidebar.indexOf("if (mounted && collapsed)");
  const end = sidebar.indexOf("\n  return (", start);
  const collapsed = start >= 0 && end > start ? sidebar.slice(start, end) : "";

  check("collapsed branch exists", () => collapsed.length > 0);

  check(
    "collapsed rail renders a nav item per visible module (icon + link)",
    () => {
      return (
        /navGroups\.map\(/.test(collapsed) &&
        /g\.modules\.map\(/.test(collapsed) &&
        /moduleIcon\(m\.key\)/.test(collapsed) &&
        /href=\{m\.href\}/.test(collapsed) &&
        /<Icon\b/.test(collapsed)
      );
    },
  );

  check("each icon carries an accessible name + hover tooltip", () => {
    // formatting-agnostic (prettier may wrap the aria-label expression)
    return (
      /aria-label=\{/.test(collapsed) &&
      /`\$\{m\.name\}, \$\{badge\} alerts`/.test(collapsed) &&
      /title=\{m\.name\}/.test(collapsed)
    );
  });

  check("active module is indicated (isNavItemActive + active fill)", () => {
    return (
      /isNavItemActive\(pathname, m\.href\)/.test(collapsed) &&
      /aria-current=\{active \? "page" : undefined\}/.test(collapsed) &&
      /active[\s\S]{0,40}bg-panel text-ink/.test(collapsed)
    );
  });

  check(
    "alert counts preserved as a small accent dot (no invented red)",
    () => {
      return (
        /badge > 0 &&/.test(collapsed) &&
        /rounded-full border border-paper bg-accent/.test(collapsed) &&
        !/\bbg-red|text-red|border-red\b/.test(collapsed)
      );
    },
  );

  check("search + expand toggle reachable when collapsed", () => {
    return (
      /aria-label="Expand sidebar"/.test(collapsed) &&
      /onClick=\{goToSearch\}/.test(collapsed) &&
      /aria-label="Search"/.test(collapsed)
    );
  });

  check("identity/UX.7 menu reachable when collapsed (icon-triggered)", () => {
    // rendered in the collapsed branch with the `collapsed` prop…
    const usesCollapsedMenu = /<UserMenu[\s\S]*?collapsed\s*\/?>/.test(
      collapsed,
    );
    // …and UserMenu's collapsed trigger keeps the full UX.7 menu (audit/notif/settings/sign-out)
    const menuKeepsItems =
      /collapsed \? "w-\[236px\]" : "right-0"/.test(sidebar) &&
      /href="\/audit"/.test(sidebar) &&
      /href="\/notifications"/.test(sidebar) &&
      /href="\/settings\/members"/.test(sidebar) &&
      /Sign out/.test(sidebar) &&
      /aria-label="Account menu"/.test(sidebar);
    return usesCollapsedMenu && menuKeepsItems;
  });

  check("expanded nav unchanged (still renders NavSection)", () => {
    return (
      /import \{ NavSection \}/.test(sidebar) &&
      /<NavSection key=\{g\.group\}/.test(sidebar) &&
      // the expanded 240px nav is still present after the collapsed branch
      /w-\[240px\]/.test(sidebar)
    );
  });

  check("Lucide thin stroke · no emoji in the rail", () => {
    return (
      /strokeWidth=\{1\.7\}/.test(collapsed) &&
      !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(collapsed) &&
      !/#[0-9a-fA-F]{3,6}\b/.test(collapsed)
    );
  });

  check("module-icons: a Lucide icon per module + a neutral fallback", () => {
    const keys = [
      "core",
      "agents",
      "workflows",
      "projects",
      "machines",
      "procurement",
      "manufacturing",
      "inventory",
      "fulfillment",
      "quality",
      "sales",
      "marketing",
      "fleet",
      '"field-service"',
      "engineering",
      "autonomy",
      "finance",
      "people",
      "security",
      "legal",
    ];
    const allMapped = keys.every((k) =>
      new RegExp(`${k.replace(/[-"]/g, "\\$&")}:`).test(icons),
    );
    const hasFallback = /export function moduleIcon\([\s\S]*?\?\?/.test(icons);
    return allMapped && hasFallback;
  });

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
