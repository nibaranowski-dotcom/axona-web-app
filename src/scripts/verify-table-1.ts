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
 * SCOPE: the primitive plus the tables migrated onto it — Procurement (TABLE.1)
 * and Unit Registry (TABLE.3b), each pixel-identical after its migration
 * (0/1,584,000 differing at 1440). Change Orders / Test Explorer / Engineering ECO
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

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run();
