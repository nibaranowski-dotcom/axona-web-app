/**
 * Verify TABLE.1 — the dense-table primitive is the single source of the
 * scroll/frozen-column mechanics. Run: pnpm verify:table-1
 *
 * UX.15 → UX.16 → UX.17 worked out how a dense table behaves: content-independent
 * tracks, a min-width and horizontal scroller instead of compressing, a frozen
 * identifier column with a conditional hairline, and a keyboard-reachable named
 * scroll region. TABLE.1 lifts that out of the Procurement PO queue into
 * `ui/DenseTable.tsx` + `ui/dense-table-tokens.ts` so it is written once.
 *
 * SCOPE: the primitive plus the tables migrated onto it — Procurement (TABLE.1),
 * Unit Registry (TABLE.3b) and the Engineering ECO table (TABLE.3c), each measured
 * against its pre-migration build at the design width. Change Orders / Test Explorer
 * are deliberately NOT migrated yet — see docs/manual-checks.md -> TABLE.1.
 *
 * This is the STATIC half that CI runs; `pnpm table-1:check` is the served half
 * that measures the scroll/pin behaviour in a real browser.
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

const ROOT = process.cwd();
const read = (p: string): string =>
  existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), "utf8") : "";
const codeOnly = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join("\n");

function run(): void {
  console.log("\nVerifying TABLE.1 — dense-table primitive\n");

  const prim = read("apps/web/components/ui/DenseTable.tsx");
  const tokens = read("apps/web/components/ui/dense-table-tokens.ts");
  const index = read("apps/web/components/ui/index.ts");
  const queue = codeOnly(read("apps/web/components/procurement/PoQueue.tsx"));
  const row = codeOnly(read("apps/web/components/procurement/PoRow.tsx"));
  const units = codeOnly(
    read("apps/web/components/units/UnitRegistryView.tsx"),
  );
  const eco = codeOnly(read("apps/web/components/engineering/EcoTable.tsx"));
  const tests = codeOnly(
    read("apps/web/components/tests/TestExplorerView.tsx"),
  );

  check("1. the primitive + its tokens exist and are exported", () => {
    return (
      /export function DenseTable/.test(prim) &&
      /export const FROZEN_CELL/.test(tokens) &&
      /export \{ DenseTable \}/.test(index) &&
      /export \{ FROZEN_CELL/.test(index)
    );
  });

  check(
    "2. tokens live OUTSIDE the client module (server consumers index them)",
    () => {
      // Next.js: a server component cannot dot/index into a "use client" module's
      // exports ("Cannot access px-5.toString on the server") — this broke /changes.
      return (
        /^"use client";/m.test(prim) &&
        !/^"use client";/m.test(tokens) &&
        /from "\.\/dense-table-tokens"/.test(index)
      );
    },
  );

  check("3. the primitive owns the scroll frame + min-width wrapper", () => {
    return (
      /overflow-x-auto/.test(prim) &&
      /<div className=\{minWidth\}>\{children\}<\/div>/.test(prim)
    );
  });

  check("4. it owns the scrolled state driving the frozen hairline", () => {
    return (
      /useState\(false\)/.test(prim) &&
      /data-scrolled=\{scrolled \? "true" : "false"\}/.test(prim) &&
      /onScroll=\{\(e\) => setScrolled\(e\.currentTarget\.scrollLeft > 0\)\}/.test(
        prim,
      )
    );
  });

  check("5. it owns a11y: focusable, named, no forced smooth scroll", () => {
    return (
      /tabIndex=\{0\}/.test(prim) &&
      /role="region"/.test(prim) &&
      /aria-label=\{label\}/.test(prim) &&
      !/scroll-smooth/.test(codeOnly(prim)) &&
      /focus-visible:ring-inset/.test(prim)
    );
  });

  check(
    "6. the frozen cell keeps the three properties UX.17 proved it needs",
    () => {
      const t = codeOnly(tokens);
      return (
        /sticky/.test(t) &&
        /left-0/.test(t) &&
        /z-\d+/.test(t) &&
        /bg-inherit/.test(t) &&
        /self-stretch/.test(t) &&
        /-ml-5[\s\S]*pl-5/.test(t) &&
        /group-data-\[scrolled=true\]:border-r/.test(t)
      );
    },
  );

  check(
    "7. Procurement consumes the primitive and duplicates none of it",
    () => {
      return (
        /<DenseTable/.test(queue) &&
        /FROZEN_CELL\["px-5"\]/.test(row) &&
        !/overflow-x-auto/.test(queue) &&
        !/data-scrolled/.test(queue) &&
        !/onScroll/.test(queue) &&
        !/useState/.test(queue) &&
        !/sticky left-0/.test(row)
      );
    },
  );

  check("8. Procurement's UX.16 track template is untouched", () => {
    return row.includes(
      "grid-cols-[minmax(56px,0.8fr)_minmax(0,2.2fr)_minmax(0,1fr)_minmax(76px,0.9fr)_112px_160px]",
    );
  });

  check(
    "9. Unit Registry consumes the primitive and duplicates none of it",
    () => {
      return (
        /<DenseTable/.test(units) &&
        /minWidth=\{UNITS_MIN_W\}/.test(units) &&
        // 998, not 1000: the floor moved inside the card's 1px borders when the
        // card became the scroller, so the card is still exactly 1000px and the
        // tracks resolve against the width they always did (TABLE.3b).
        /const UNITS_MIN_W = "min-w-\[998px\]"/.test(units) &&
        !/overflow-x-auto/.test(units) &&
        !/data-scrolled/.test(units) &&
        !/onScroll/.test(units) &&
        !/sticky left-0/.test(units)
      );
    },
  );

  check("10. Unit Registry's tracks are content-independent (UX.16)", () => {
    // The primitive's one contract on a consumer's template: no bare `Nfr`,
    // which is `minmax(auto, Nfr)` and lets rows inflate tracks the short header
    // labels do not — header and body then drift apart off one template.
    // Every template in the file, not just the first: a second one added later
    // owes the same contract, and matching only [0] would stop looking at it.
    const templates = [...units.matchAll(/grid-cols-\[([^\]]+)\]/g)].flatMap(
      (m) => m[1] ?? [],
    );
    if (templates.length === 0) return false;
    return templates.every((t) =>
      t
        .split("_")
        .every((track) => /^(minmax\(.+\)|\d+(\.\d+)?px)$/.test(track)),
    );
  });

  check("11. Unit Registry pins its serial on the canonical shell", () => {
    // TABLE.3b: the rounded card IS the scroller (one element). A nested
    // `overflow-hidden` card between the sticky cell and the scrollport is what
    // made the first cut pin nothing — sticky resolved against the card, which
    // scrolled as a unit. Asserted so it cannot creep back: the card classes must
    // ride on the DenseTable itself, and no inner clipping box may reappear.
    const cardOnScroller =
      /className=\{`min-w-0 \$\{CARD\}`\}/.test(units) &&
      /const CARD = "rounded-card border border-line bg-paper"/.test(units);
    // `bg-inherit` only occludes if the row it inherits from is itself opaque.
    const opaqueRows =
      /const ROW_BG = "bg-paper hover:bg-panel-2"/.test(units) &&
      /const HEADER_BG = "bg-paper"/.test(units);
    return (
      cardOnScroller &&
      opaqueRows &&
      /FROZEN_CELL\["px-\[18px\]"\]/.test(units) &&
      !/overflow-hidden/.test(units)
    );
  });

  check(
    "12. Engineering ECO consumes the primitive and duplicates none of it",
    () => {
      return (
        /<DenseTable/.test(eco) &&
        /minWidth=\{ECO_MIN_W\}/.test(eco) &&
        /const ECO_MIN_W = "min-w-\[746px\]"/.test(eco) &&
        !/overflow-x-auto/.test(eco) &&
        !/data-scrolled/.test(eco) &&
        !/onScroll/.test(eco) &&
        !/sticky left-0/.test(eco)
      );
    },
  );

  check("13. Engineering ECO pins its code on the canonical shell", () => {
    // TABLE.3c: this card owns a heading, so the scroller wraps only the table and
    // carries the bottom corners; the card itself must clip NOTHING, or the sticky
    // cell resolves against it and pins nothing (the TABLE.3b failure). The card
    // was `overflow-hidden` before this story — that regression must not return.
    const shell =
      !/overflow-hidden/.test(eco) &&
      /className="rounded-b-card"/.test(eco) &&
      /const ROW_BG = "bg-paper hover:bg-panel-2"/.test(eco) &&
      /const HEADER_BG = "bg-paper"/.test(eco);
    // Content-independent tracks, same contract as /units.
    const template = eco.match(/grid-cols-\[([^\]]+)\]/)?.[1];
    const tracks =
      !!template &&
      template
        .split("_")
        .every((t) => /^(minmax\(.+\)|\d+(\.\d+)?px)$/.test(t));
    return shell && tracks && /FROZEN_CELL\["px-5"\]/.test(eco);
  });

  check("14. the 2-column freeze is defined ONCE, in the tokens", () => {
    const t = codeOnly(tokens);
    // The lead pins at the scroller edge and draws NO hairline; the next pins beside
    // it and draws the only one. `left-[46px]` = 18px row padding + the 28px checkbox
    // track; `-ml-3/pl-3` closes the 12px grid gap so the two backgrounds meet —
    // without it the row scrolls visibly through the slot between them.
    const lead = t.match(/lead:\s*"([^"]+)"/)?.[1] ?? "";
    const next = t.match(/next:\s*"([^"]+)"/)?.[1] ?? "";
    return (
      /export const FROZEN_PAIR/.test(t) &&
      /sticky left-0/.test(lead) &&
      !/border-r/.test(lead) &&
      /sticky left-\[46px\]/.test(next) &&
      /-ml-3 pl-3/.test(next) &&
      /group-data-\[scrolled=true\]:border-r/.test(next) &&
      /bg-inherit/.test(lead) &&
      /bg-inherit/.test(next) &&
      /self-stretch/.test(lead) &&
      /self-stretch/.test(next)
    );
  });

  check("15. Test Explorer freezes BOTH leading columns, per group", () => {
    // Every group card is its own scroller (TABLE.3c's scoping: the card owns a
    // heading, so the scroller wraps only the table). No clipping box may sit
    // between the sticky cells and it — the card's `overflow-hidden` is gone.
    const shell =
      /<DenseTable/.test(tests) &&
      /minWidth=\{TESTS_MIN_W\}/.test(tests) &&
      /const TESTS_MIN_W = "min-w-\[746px\]"/.test(tests) &&
      /className="rounded-b-card"/.test(tests) &&
      // The GROUP CARD specifically must not clip. Scoped, not a file-wide ban:
      // the compare dialog in this file has its own unrelated `overflow-hidden`
      // table, and banning the string outright would fail on that.
      /className="rounded-card border border-line bg-paper"/.test(tests) &&
      !/overflow-hidden rounded-(card|\[14px\])/.test(tests) &&
      !/overflow-x-auto/.test(tests) &&
      !/onScroll/.test(tests);
    // Both frozen cells, in both the column-header row and the data rows — the
    // header must pin in lockstep or it drifts off the body across the freeze.
    const leads = tests.match(/FROZEN_PAIR\.lead/g)?.length ?? 0;
    const nexts = tests.match(/FROZEN_PAIR\.next/g)?.length ?? 0;
    const opaque =
      /const ROW_BG = "bg-paper hover:bg-panel-2"/.test(tests) &&
      /const HEADER_BG = "bg-paper"/.test(tests);
    const template = tests.match(/grid-cols-\[([^\]]+)\]/)?.[1];
    const tracks =
      !!template &&
      template
        .split("_")
        .every((x) => /^(minmax\(.+\)|\d+(\.\d+)?px)$/.test(x));
    return shell && leads >= 2 && nexts >= 2 && opaque && tracks;
  });

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run();
