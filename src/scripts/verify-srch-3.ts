/**
 * Verify SRCH.3 — command palette (⌘K). Static checks; interaction in manual-checks.
 * Run: pnpm verify:srch-3
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;
const root = process.cwd();
const base = join(root, "apps/web");
const read = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");
const check = (label: string, ok: boolean) => {
  console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
  ok ? passed++ : failed++;
};

console.log("\nVerifying SRCH.3 — command palette\n");

for (const c of ["CommandPalette", "ScopeTabs", "Results"]) {
  check(
    `component search/${c}.tsx`,
    existsSync(join(base, `components/search/${c}.tsx`)),
  );
}

const useSearchTs = read(join(base, "lib/use-search.ts"));
check(
  "useSearch debounced + abortable",
  /AbortController/.test(useSearchTs) && /setTimeout/.test(useSearchTs),
);
check("useSearch hits /api/search", /\/api\/search/.test(useSearchTs));

check(
  // LOGIN.1 — the palette is mounted client-only (CommandPaletteMount, ssr:false)
  // by the (shell) layout + the launcher, NOT the root layout. Mounting it in the
  // root layout server-rendered this client component onto public/not-found routes
  // and 500-ed /login in Next dev; it stays globally reachable via ⌘K on every
  // route that can open it. See specs/PRD-LOGIN.1.md.
  "palette mounted client-only on the shell + launcher (NOT the root layout)",
  ((): boolean => {
    const mount = read(join(base, "components/search/CommandPaletteMount.tsx"));
    const shell = read(join(base, "app/(shell)/layout.tsx"));
    const launcher = read(join(base, "components/core/Launcher.tsx"));
    const rootLayout = read(join(base, "app/layout.tsx"));
    return (
      /ssr:\s*false/.test(mount) &&
      /CommandPaletteMount/.test(shell) &&
      /CommandPaletteMount/.test(launcher) &&
      !/CommandPalette/.test(rootLayout) // the root layout must NOT mount it
    );
  })(),
);

const palette = read(join(base, "components/search/CommandPalette.tsx"));
check(
  "⌘K / Ctrl+K open handler",
  /metaKey|ctrlKey/.test(palette) && /["']k["']/i.test(palette),
);
check(
  "scope tabs use counts",
  /counts/.test(read(join(base, "components/search/ScopeTabs.tsx"))),
);
check(
  "a11y roles present (dialog + combobox + listbox)",
  /role="dialog"/.test(palette) &&
    /role="combobox"/.test(palette) &&
    /role="listbox"/.test(read(join(base, "components/search/Results.tsx"))),
);
// SUPERSEDED BY SRCH.4 — and re-pointed rather than deleted.
//
// This asserted the OPPOSITE skin: "dark full-screen (bg-mission + on-dark; no white
// modal)". SRCH.3 built that deliberately from the v8 `Search.dc.html`, which is a
// dark, full-page screen. SRCH.4's design of record (the v10 export) makes the palette
// a LIGHT MODAL CARD over a dimmed, blurred backdrop, opened over the current screen
// — so the old assertion now fails BY DESIGN, and leaving it would force the next
// person to choose between a green gate and the current design.
//
// What SRCH.3 actually cared about survives and is asserted here: the palette is one
// OVERLAY surface (not a route change) that covers the screen it opened over. Only the
// skin claim changed. The full palette contract is gated by `verify:srch-4b`.
check(
  "the palette is a full-viewport OVERLAY over the current screen (SRCH.4: light modal)",
  /fixed inset-0/.test(palette) &&
    /backdrop-blur/.test(palette) &&
    /bg-paper/.test(palette) &&
    !/bg-mission/.test(palette),
);
check(
  "focus restore on close (prevFocus)",
  /prevFocus/.test(palette) || /activeElement/.test(palette),
);

// /search deep-link route opens the palette
check(
  "/search route seeds the palette (deepLinkQuery)",
  /deepLinkQuery/.test(read(join(base, "app/search/page.tsx"))),
);

// Sidebar search bar routes to Mission Control (⌘K keeps the overlay); MC/Search
// off the nav.
const sidebar = read(join(base, "components/shell/Sidebar.tsx"));
check(
  "sidebar search bar routes to Mission Control (/launcher — UX.3)",
  /router\.push\("\/launcher"\)/.test(sidebar),
);
check(
  "sidebar nav hides mission-control + search",
  /HIDDEN_FROM_NAV/.test(sidebar) &&
    /"mission-control"/.test(sidebar) &&
    /"search"/.test(sidebar),
);
check(
  "launcher field opens the palette",
  /openPalette/.test(read(join(base, "components/core/Launcher.tsx"))),
);

// token hygiene in the palette components
const all = readdirSync(join(base, "components/search"))
  .map((f) => read(join(base, "components/search", f)))
  .join("\n");
check(
  "no emoji / no raw hex in palette components",
  !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(all) &&
    !/#[0-9a-fA-F]{3,6}\b/.test(all),
);

if (failed === 0) {
  console.log(`\nPASSED — ${passed} checks`);
} else {
  console.log(`\nFAILED — ${failed} check(s) failed`);
  process.exit(1);
}
