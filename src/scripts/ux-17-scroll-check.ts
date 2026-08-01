/**
 * UX.17 — the SERVED narrow-width check for the Procurement PO queue.
 *
 * Proves both regimes of the single min-width rule:
 *   · narrow (card < 672px)  → the queue SCROLLS horizontally, the PO column stays
 *     pinned at the left edge, and its hairline appears once content slides under it
 *   · wide   (card ≥ 672px)  → nothing to scroll, no scrollbar, layout identical to
 *     UX.16 (`pnpm ux-16:columns` is the 0px-drift half of the proof)
 *
 *   pnpm ux-17:scroll                       measure (exit 1 if a regime is wrong)
 *   UX17_SHOT_DIR=/tmp pnpm ux-17:scroll    also write before/after screenshots
 *
 * Needs the app + a seeded DB running, so it is NOT part of `verify:all` (same
 * contract as `pnpm a11y:scan` and `pnpm ux-16:columns`).
 */
import { chromium, type Page } from "playwright";

const BASE = process.env.A11Y_BASE_URL ?? "http://localhost:3001";
const EMAIL = process.env.A11Y_EMAIL ?? "admin@axona-demo.test";
const PASSWORD = process.env.A11Y_PASSWORD ?? "axona-dev-2026!";
const SHOT_DIR = process.env.UX17_SHOT_DIR;
/** Card width at/above which the table must not scroll (see PO_MIN_W in PoRow). */
const MIN_W = 672;
const NARROW = [1180, 1280];
const WIDE = [1366, 1440, 1512, 1728];

interface Probe {
  error: string | null;
  clientWidth: number;
  scrollWidth: number;
  scrollLeft: number;
  scrollable: boolean;
  focusable: boolean;
  hasName: boolean;
  smoothForced: boolean;
  poLeft: number;
  poSticky: boolean;
  dataScrolled: string;
  hairline: boolean;
}

/** Runs IN THE PAGE — plain-JS string (tsx rewrites named callbacks with `__name`). */
const PROBE = `(() => {
  var region = document.querySelector('[aria-label="Purchase order queue"]');
  var empty = { error: 'scroll region not found', clientWidth: 0, scrollWidth: 0, scrollLeft: 0,
    scrollable: false, focusable: false, hasName: false, smoothForced: false,
    poLeft: 0, poSticky: false, dataScrolled: '', hairline: false };
  if (!region) return empty;
  var cs = getComputedStyle(region);
  var grids = Array.prototype.slice.call(region.querySelectorAll('div')).filter(function (d) {
    return getComputedStyle(d).display === 'grid' && String(d.className).indexOf('grid-cols-[') !== -1;
  });
  var firstRow = null;
  for (var i = 0; i < grids.length; i++) {
    if ((grids[i].textContent || '').indexOf('PO-') === 0) { firstRow = grids[i]; break; }
  }
  if (!firstRow) return { ...empty, error: 'no PO row found' };
  var po = firstRow.children[0];
  var pcs = getComputedStyle(po);
  var round = function (n) { return Math.round(n * 100) / 100; };
  return {
    error: null,
    clientWidth: region.clientWidth,
    scrollWidth: region.scrollWidth,
    scrollLeft: round(region.scrollLeft),
    scrollable: region.scrollWidth > region.clientWidth,
    focusable: region.getAttribute('tabindex') === '0',
    hasName: !!region.getAttribute('aria-label'),
    smoothForced: cs.scrollBehavior === 'smooth',
    poLeft: round(po.getBoundingClientRect().left - region.getBoundingClientRect().left),
    poSticky: pcs.position === 'sticky',
    dataScrolled: region.getAttribute('data-scrolled') || '',
    hairline: parseFloat(pcs.borderRightWidth) > 0
  };
})()`;

async function signIn(page: Page): Promise<void> {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#login-email", { timeout: 60_000 });
  await page.waitForTimeout(1_500);
  await page.fill("#login-email", EMAIL);
  await page.fill("#login-password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), {
    timeout: 60_000,
    waitUntil: "commit",
  });
}

async function probe(page: Page): Promise<Probe> {
  return (await page.evaluate(PROBE)) as Probe;
}

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
  });
  await signIn(page);
  await page.goto(`${BASE}/procurement`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 15_000 });
  await page.waitForTimeout(1200);

  console.log("\nUX.17 — Procurement PO queue, narrow-width behaviour\n");
  let failed = false;

  const shot = async (name: string) => {
    if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/${name}.png` });
  };

  for (const width of [...NARROW, ...WIDE]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.waitForTimeout(400);
    // reset to the left edge before measuring the un-scrolled state
    await page.evaluate(
      `document.querySelector('[aria-label="Purchase order queue"]').scrollLeft = 0`,
    );
    await page.waitForTimeout(250);
    const p = await probe(page);
    if (p.error) {
      console.log(`  FAIL ${width}px — ${p.error}`);
      failed = true;
      continue;
    }

    const narrow = p.clientWidth < MIN_W;
    const problems: string[] = [];

    if (narrow) {
      if (!p.scrollable) problems.push("expected a horizontal scroller");
      if (SHOT_DIR && width === 1280) await shot("ux17-1280-unscrolled");
      // scroll right and re-probe: the PO column must stay pinned at x=0 and the
      // hairline must appear now that content is underneath it
      // Scroll to the far right. The browser clamps to (scrollWidth - clientWidth),
      // which at 1280 is only 86px — so assert against the achievable maximum, not
      // an arbitrary pixel count.
      await page.evaluate(
        `(() => { const r = document.querySelector('[aria-label="Purchase order queue"]');
                  r.scrollLeft = r.scrollWidth; })()`,
      );
      await page.waitForTimeout(350);
      const s = await probe(page);
      const maxScroll = p.scrollWidth - p.clientWidth;
      if (s.scrollLeft <= 0) problems.push("did not actually scroll");
      else if (Math.abs(s.scrollLeft - maxScroll) > 1)
        problems.push(
          `scrolled to ${s.scrollLeft}px, expected the ${maxScroll}px maximum`,
        );
      if (Math.abs(s.poLeft) > 1)
        problems.push(
          `PO column drifted to ${s.poLeft}px (must stay pinned at 0)`,
        );
      if (!s.poSticky) problems.push("PO column is not sticky");
      if (s.dataScrolled !== "true")
        problems.push("data-scrolled did not flip on scroll");
      if (!s.hairline) problems.push("frozen-column hairline did not appear");
      if (SHOT_DIR && width === 1280) await shot("ux17-1280-scrolled-pinned");
      console.log(
        `  ${problems.length ? "FAIL" : "  ok"} ${width}px · card ${p.clientWidth}px · SCROLLS ${maxScroll}px (content ${p.scrollWidth}px) · PO pinned at ${s.poLeft}px · hairline ${s.hairline ? "on" : "off"}`,
      );
    } else {
      if (p.scrollable)
        problems.push(
          `must NOT scroll at this width (content ${p.scrollWidth} > card ${p.clientWidth})`,
        );
      if (p.hairline)
        problems.push("hairline must be absent when not scrolled");
      if (p.dataScrolled !== "false")
        problems.push("data-scrolled should be false");
      if (SHOT_DIR && width === 1440) await shot("ux17-1440-unchanged");
      console.log(
        `  ${problems.length ? "FAIL" : "  ok"} ${width}px · card ${p.clientWidth}px · no scroll · unchanged from UX.16`,
      );
    }

    // accessibility invariants hold in both regimes
    if (!p.focusable) problems.push("scroll region is not keyboard-focusable");
    if (!p.hasName) problems.push("focusable region has no accessible name");
    if (p.smoothForced)
      problems.push(
        "scroll-behavior:smooth is forced (breaks prefers-reduced-motion)",
      );

    for (const x of problems) console.log(`         ${x}`);
    if (problems.length) failed = true;
  }

  await browser.close();
  console.log(
    `\n  ${failed ? "FAIL" : "PASS"} — narrow scrolls with the PO column pinned; ≥${MIN_W}px card is unchanged\n`,
  );
  process.exit(failed ? 1 : 0);
}

void main();
