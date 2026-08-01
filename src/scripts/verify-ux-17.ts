/**
 * Verify UX.17 — the Procurement PO queue scrolls instead of compressing.
 * Run: pnpm verify:ux-17
 *
 * UX.16 made the tracks content-independent and flush, but Item/Vendor are
 * `minmax(0, …)`: below a ~672px card the six tracks (incl. the 160px action
 * column) have nowhere to go, so those two squeeze toward zero (Item 56px,
 * Vendor 26px at a 588px card) and the BR.1 flags clip.
 *
 * The fix is ONE rule, not a breakpoint: the table carries its own minimum width
 * and lives in a horizontal scroller, with the PO identifier frozen at the left
 * edge. Above the minimum the scroller has nothing to scroll and the layout is
 * UX.16 exactly — verified at 0px drift by `pnpm ux-16:columns`, and pixel-diffed
 * at 1440px (29 of 1.58M pixels differ, max delta 8/255, all on the card's top
 * hairline anti-aliasing; the table body is identical).
 *
 * These are static checks over that structure. `pnpm ux-17:scroll` is the served
 * proof of both regimes (it needs the app running, so it is not in verify:all).
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

function run(): void {
  console.log(
    "\nVerifying UX.17 — PO queue narrow-width scroll + frozen column\n",
  );

  /** Assert what the code DOES — the comments legitimately name what NOT to do. */
  const codeOnly = (src: string): string =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*)/.test(l))
      .join("\n");

  const row = codeOnly(read("apps/web/components/procurement/PoRow.tsx"));
  const queue = codeOnly(read("apps/web/components/procurement/PoQueue.tsx"));
  // TABLE.1 moved the MECHANICS into the shared primitive. UX.17's guarantees are
  // unchanged; they are just asserted where the behaviour now lives. Procurement's
  // own contract (its template, its minimum, which cell is frozen) stays below.
  const prim = codeOnly(read("apps/web/components/ui/DenseTable.tsx"));
  const tokens = codeOnly(read("apps/web/components/ui/dense-table-tokens.ts"));

  check(
    "PoRow.tsx / PoQueue.tsx exist",
    () => row.length > 0 && queue.length > 0,
  );

  check("1. the table declares its own minimum width", () => {
    const m = /export const PO_MIN_W = "min-w-\[(\d+)px\]";/.exec(row);
    // 56 + 116 + 52 + 76 + 112 + 160 tracks + 60 gap + 40 padding
    return !!m && Number(m[1]) === 672 && queue.includes("PO_MIN_W");
  });

  check("2. the UX.16 track template is UNCHANGED", () => {
    return row.includes(
      "grid-cols-[minmax(56px,0.8fr)_minmax(0,2.2fr)_minmax(0,1fr)_minmax(76px,0.9fr)_112px_160px]",
    );
  });

  check("3. header + rows share one horizontal scroller", () => {
    // the min-width wrapper holds BOTH, so they scroll locked together
    const scroller = /className="group overflow-x-auto[^"]*"/.test(prim);
    const wrapper = /<div className=\{minWidth\}>\{children\}<\/div>/.test(
      prim,
    );
    // anchor on the JSX usage `${PO_HEADER_COLS}` — plain "PO_HEADER_COLS" also
    // matches the import line at the top of the file, which is always first
    // header + rows are both inside the one <DenseTable minWidth={PO_MIN_W}>
    const headerUse = queue.indexOf("${PO_HEADER_COLS}");
    const headerInside =
      headerUse > queue.indexOf("<DenseTable") &&
      headerUse < queue.indexOf("<PoRow");
    return scroller && wrapper && headerInside;
  });

  check("4. the PO column is frozen (sticky, layered, opaque)", () => {
    const s = /"px-5":\s*\n?\s*"([^"]+)"/.exec(tokens)?.[1] ?? "";
    return (
      /FROZEN_CELL\["px-5"\]/.test(row) &&
      s.includes("sticky") &&
      s.includes("left-0") &&
      /z-\d+/.test(s) &&
      // bg-inherit, not a fixed token: the pinned cell must follow the row's
      // hover:bg-panel-2 instead of punching a paper-coloured hole in it
      s.includes("bg-inherit") &&
      // full row height, or scrolled content shows through above/below the text
      s.includes("self-stretch") &&
      // the row's px-5 padding, restored (left-0 pins to the scroller, not the row)
      s.includes("-ml-5") &&
      s.includes("pl-5")
    );
  });

  check(
    "4b. the header's PO cell freezes too (header/body stay locked)",
    () => {
      return (
        /PO_STICKY_PO/.test(queue) && /export const PO_STICKY_PO/.test(row)
      );
    },
  );

  check("5. the row is opaque so the frozen cell can inherit it", () => {
    return /border-t border-line bg-paper py-\[14px\] hover:bg-panel-2/.test(
      row,
    );
  });

  check("6. the hairline appears ONLY when actually scrolled", () => {
    // A permanent border-r would draw a vertical rule through the table at every
    // width; the design has none and ≥1366px must stay identical to UX.16.
    const s = /"px-5":\s*\n?\s*"([^"]+)"/.exec(tokens)?.[1] ?? "";
    const conditional = s.includes("group-data-[scrolled=true]:border-r");
    const unconditional = /(^|\s)border-r(\s|$)/.test(s);
    return (
      conditional &&
      !unconditional &&
      /data-scrolled=\{scrolled \? "true" : "false"\}/.test(prim) &&
      /onScroll=\{\(e\) => setScrolled\(e\.currentTarget\.scrollLeft > 0\)\}/.test(
        prim,
      )
    );
  });

  check(
    "7. a11y: the scroller is focusable, named, and not force-smoothed",
    () => {
      return (
        /tabIndex=\{0\}/.test(prim) &&
        /label="Purchase order queue"/.test(queue) &&
        /aria-label=\{label\}/.test(prim) &&
        /role="region"/.test(prim) &&
        // leaving scroll-behaviour at the browser default is what honours
        // prefers-reduced-motion — forcing smooth scrolling is the violation
        !/scroll-smooth/.test(prim) &&
        // the focus ring must sit inside the card's rounded clip
        /focus-visible:ring-inset/.test(prim)
      );
    },
  );

  check("8. v2 tokens only — no raw hex in the touched files", () => {
    const hex = /#[0-9a-fA-F]{3,8}\b/;
    return !hex.test(row) && !hex.test(queue);
  });

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run();
