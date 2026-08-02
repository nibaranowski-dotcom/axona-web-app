/**
 * TABLE.1 — the SERVED check for every dense table on the DenseTable primitive.
 *
 * One script, five tables. For each it proves BOTH regimes of the single
 * min-width rule the primitive implements:
 *   · narrow (card < the table's minimum) → scrolls horizontally, the identifier
 *     column stays pinned at the left edge, its hairline appears once content
 *     slides under it
 *   · wide (card >= the minimum) → nothing to scroll, no scrollbar, and the grid
 *     resolves exactly as it did before the migration
 *
 *   pnpm table-1:check                          measure (exit 1 on any failure)
 *   TABLE1_SHOT_DIR=/tmp pnpm table-1:check     also write 1280 + 1440 screenshots
 *   TABLE1_ONLY=units pnpm table-1:check        one table
 *
 * Needs the app + a seeded DB, so it is NOT part of verify:all (same contract as
 * a11y:scan / ux-16:columns / ux-17:scroll). `pnpm verify:table-1` is the static
 * half that CI runs.
 */
import { chromium, type Page } from "playwright";

const BASE = process.env.A11Y_BASE_URL ?? "http://localhost:3001";
const EMAIL = process.env.A11Y_EMAIL ?? "admin@axona-demo.test";
const PASSWORD = process.env.A11Y_PASSWORD ?? "axona-dev-2026!";
const SHOT_DIR = process.env.TABLE1_SHOT_DIR;
const ONLY = process.env.TABLE1_ONLY;

interface Target {
  key: string;
  path: string;
  label: string;
  /**
   * How to find the scroll region. Defaults to an exact aria-label match; Test
   * Explorer names each per-procedure scroller after its procedure (distinct
   * accessible names, one scroller per group card), so it matches on the suffix and
   * the probe measures the FIRST group.
   */
  regionSelector?: string;
  /** The table's own minimum width (PO_MIN_W and friends). */
  minWidth: number;
  /** How many leading columns freeze. */
  frozen: number;
  /** Viewports that must scroll / must not. */
  narrow: number[];
  wide: number[];
  /** How many scroll regions the screen is expected to have (default 1). */
  regions?: number;
}

const TARGETS: Target[] = [
  {
    key: "procurement",
    path: "/procurement",
    label: "Purchase order queue",
    minWidth: 672,
    frozen: 1,
    narrow: [1180, 1280],
    wide: [1366, 1440, 1512],
  },
  {
    key: "units",
    path: "/units",
    label: "Unit registry",
    // 998, not 1000: the card is now the scroller, so the floor is its CONTENT
    // width and its 1px borders sit outside — the card is still exactly 1000px.
    minWidth: 998,
    frozen: 1, // the serial, on the canonical shell (card == scroller)
    narrow: [1180, 1280, 1366],
    wide: [1728],
  },
  {
    key: "engineering",
    path: "/engineering",
    label: "Change orders table",
    // The ECO table's floor is its design-width layout: a 748px card at 1440, 746px
    // inside the borders. The scroller sits INSIDE this card (the card owns a
    // heading that must not slide away), so the floor is the scroller's content.
    minWidth: 746,
    frozen: 1, // the ECO code
    narrow: [1180, 1280, 1366],
    wide: [1440, 1512, 1728],
  },
  {
    key: "tests",
    path: "/tests",
    label: "Test runs (per procedure group)",
    // One scroller per procedure group card, each named "<procedure> runs".
    regionSelector: '[role="region"][aria-label$=" runs"]',
    regions: 4,
    // Same rule as the ECO table: the design-width layout (746px inside a 748px
    // card at 1440). See the note in TestExplorerView about the .dc.html's wider
    // page-level 920px floor, which is design's call, not this story's.
    minWidth: 746,
    frozen: 2, // the selection checkbox AND the run code behind it
    narrow: [1180, 1280, 1366],
    wide: [1440, 1512, 1728],
  },
  // Change Orders is NOT here yet — migrated in its own story with mandatory
  // parity at 1440 (see docs/manual-checks.md -> TABLE.1).
];

const PROBE = (selector: string, frozen: number) => `(() => {
  var all = document.querySelectorAll(${JSON.stringify(selector)});
  var region = all[0];
  var empty = { error: 'scroll region not found', clientWidth: 0, scrollWidth: 0, scrollLeft: 0,
    scrollable: false, focusable: false, hasName: false, smoothForced: false,
    pinned: [], headerPinned: [], sticky: [], edges: [], dataScrolled: '', hairline: false,
    regions: all.length };
  if (!region) return empty;
  var cs = getComputedStyle(region);
  var grids = Array.prototype.slice.call(region.querySelectorAll('div,a')).filter(function (d) {
    return getComputedStyle(d).display === 'grid' && String(d.className).indexOf('grid-cols-[') !== -1;
  });
  if (!grids.length) return Object.assign(empty, { error: 'no grid rows inside the region' });
  var rr = region.getBoundingClientRect();
  // Frozen-cell offsets, measured on BOTH the column-header row (grids[0]) and a
  // data row (the last grid). They must agree, or the header and the body have
  // drifted apart across the freeze — the Test Explorer failure mode (TABLE.2).
  var offsets = function (row) {
    var out = { pinned: [], sticky: [], edges: [] };
    for (var i = 0; i < ${frozen}; i++) {
      var cell = row.children[i];
      if (!cell) break;
      var ccs = getComputedStyle(cell);
      out.pinned.push(Math.round((cell.getBoundingClientRect().left - rr.left) * 100) / 100);
      out.sticky.push(ccs.position === 'sticky');
      out.edges.push(parseFloat(ccs.borderRightWidth) > 0);
    }
    return out;
  };
  var body = offsets(grids[grids.length - 1]);
  var head = offsets(grids[0]);
  return {
    error: null,
    clientWidth: region.clientWidth,
    scrollWidth: region.scrollWidth,
    scrollLeft: Math.round(region.scrollLeft * 100) / 100,
    scrollable: region.scrollWidth > region.clientWidth,
    focusable: region.getAttribute('tabindex') === '0',
    hasName: !!region.getAttribute('aria-label'),
    smoothForced: cs.scrollBehavior === 'smooth',
    pinned: body.pinned, headerPinned: head.pinned,
    sticky: body.sticky, edges: body.edges,
    dataScrolled: region.getAttribute('data-scrolled') || '',
    hairline: body.edges.length > 0 && body.edges[body.edges.length - 1],
    regions: all.length
  };
})()`;

interface Probe {
  error: string | null;
  clientWidth: number;
  scrollWidth: number;
  scrollLeft: number;
  scrollable: boolean;
  focusable: boolean;
  hasName: boolean;
  smoothForced: boolean;
  pinned: number[];
  headerPinned: number[];
  sticky: boolean[];
  edges: boolean[];
  dataScrolled: string;
  hairline: boolean;
  regions: number;
}

async function signIn(page: Page): Promise<void> {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#login-email", { timeout: 60_000 });
  await page.waitForTimeout(1500);
  await page.fill("#login-email", EMAIL);
  await page.fill("#login-password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), {
    timeout: 60_000,
    waitUntil: "commit",
  });
}

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
  });
  await signIn(page);

  let failed = false;
  const targets = ONLY ? TARGETS.filter((t) => t.key === ONLY) : TARGETS;

  for (const t of targets) {
    console.log(
      `\n═══ ${t.key}  (${t.path})  min-width ${t.minWidth}px  frozen ${t.frozen} ═══`,
    );
    await page.goto(`${BASE}${t.path}`, { waitUntil: "domcontentloaded" });
    await page
      .waitForSelector("h1", { timeout: 20_000 })
      .catch(() => undefined);
    await page.waitForTimeout(1500);

    // Every matching region, not just the first: Test Explorer has one scroller per
    // procedure group, and a screenshot with only the first group scrolled would
    // hide whether the rest pin at all.
    const sel = t.regionSelector ?? `[aria-label=${JSON.stringify(t.label)}]`;
    const each = (body: string) =>
      `(() => { document.querySelectorAll(${JSON.stringify(sel)}).forEach((r) => { ${body} }); })()`;
    const reset = each("r.scrollLeft = 0;");
    const toEnd = each("r.scrollLeft = r.scrollWidth;");

    for (const width of [...t.narrow, ...t.wide]) {
      await page.setViewportSize({ width, height: 1100 });
      await page.waitForTimeout(400);
      await page.evaluate(reset);
      await page.waitForTimeout(250);
      const p = (await page.evaluate(PROBE(sel, t.frozen))) as Probe;
      if (p.error) {
        console.log(`  FAIL ${width}px — ${p.error}`);
        failed = true;
        continue;
      }
      const problems: string[] = [];
      const mustScroll = t.narrow.includes(width);

      if (mustScroll) {
        if (!p.scrollable) problems.push("expected a horizontal scroller");
        if (SHOT_DIR && width === 1280)
          await page.screenshot({
            path: `${SHOT_DIR}/table1-${t.key}-1280-unscrolled.png`,
          });
        await page.evaluate(toEnd);
        await page.waitForTimeout(350);
        const s = (await page.evaluate(PROBE(sel, t.frozen))) as Probe;
        const maxScroll = p.scrollWidth - p.clientWidth;
        if (s.scrollLeft <= 0) problems.push("did not actually scroll");
        if (s.dataScrolled !== "true")
          problems.push("data-scrolled did not flip");
        // `frozen: 0` is a real configuration, not an omission: a design that nests
        // its card (with overflow-hidden) between the sticky cell and the scrollport
        // cannot pin a column at all, so the table gets the scroll floor WITHOUT a
        // frozen identifier. Only assert pinning where a column is meant to freeze.
        if (t.frozen > 0) {
          if (s.sticky.length < t.frozen)
            problems.push(
              `only ${s.sticky.length} of ${t.frozen} frozen cells`,
            );
          if (!s.sticky.every(Boolean))
            problems.push("frozen column(s) not sticky");
          if (s.pinned.some((x, i) => (i === 0 ? Math.abs(x) > 1 : x < 0)))
            problems.push(`frozen column drifted: [${s.pinned.join(", ")}]`);
          // A multi-column freeze must stay in reading order once pinned: cell 2
          // sits to the RIGHT of cell 1, or the two pinned cells overlap.
          if (
            s.pinned.some((x, i) => i > 0 && x <= (s.pinned[i - 1] as number))
          )
            problems.push(
              `frozen columns out of order: [${s.pinned.join(", ")}]`,
            );
          // The group headers must pin in lockstep with the body — the whole point
          // of TABLE.2's repeating per-procedure headers.
          if (
            s.headerPinned.length !== s.pinned.length ||
            s.headerPinned.some(
              (x, i) => Math.abs(x - (s.pinned[i] as number)) > 0.5,
            )
          )
            problems.push(
              `header/body drift across the freeze: header [${s.headerPinned.join(", ")}] vs rows [${s.pinned.join(", ")}]`,
            );
          // Exactly ONE hairline, on the LAST frozen column: a rule between two
          // pinned columns is a divider the v2 design has nowhere.
          if (!s.hairline)
            problems.push("frozen-column hairline did not appear");
          if (s.edges.slice(0, -1).some(Boolean))
            problems.push(
              `hairline on a non-final frozen column: [${s.edges.join(", ")}]`,
            );
        }
        if (t.regions && s.regions !== t.regions)
          problems.push(
            `expected ${t.regions} scroll regions, found ${s.regions}`,
          );
        if (SHOT_DIR && width === 1280)
          await page.screenshot({
            path: `${SHOT_DIR}/table1-${t.key}-1280-scrolled.png`,
          });
        console.log(
          `  ${problems.length ? "FAIL" : "  ok"} ${width}px · card ${p.clientWidth}px · SCROLLS ${maxScroll}px · ${t.frozen > 0 ? `pinned [${s.pinned.join(", ")}] (header [${s.headerPinned.join(", ")}]) · hairline ${s.hairline ? "on" : "off"}` : "no frozen column (by design)"}`,
        );
      } else {
        if (p.scrollable)
          problems.push(
            `must NOT scroll (content ${p.scrollWidth} > card ${p.clientWidth})`,
          );
        if (p.hairline)
          problems.push("hairline must be absent when not scrolled");
        if (SHOT_DIR && width === 1440)
          await page.screenshot({
            path: `${SHOT_DIR}/table1-${t.key}-1440.png`,
          });
        console.log(
          `  ${problems.length ? "FAIL" : "  ok"} ${width}px · card ${p.clientWidth}px · no scroll`,
        );
      }

      if (!p.focusable)
        problems.push("scroll region is not keyboard-focusable");
      if (!p.hasName) problems.push("focusable region has no accessible name");
      if (p.smoothForced) problems.push("scroll-behavior:smooth is forced");
      for (const x of problems) console.log(`         ${x}`);
      if (problems.length) failed = true;
    }
  }

  await browser.close();
  console.log(
    `\n  ${failed ? "FAIL" : "PASS"} — all dense tables scroll+pin narrow, unchanged wide\n`,
  );
  process.exit(failed ? 1 : 0);
}

void main();
