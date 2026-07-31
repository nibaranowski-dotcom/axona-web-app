/**
 * UX.16 — the SERVED column-alignment check for the Procurement PO queue.
 *
 * Drives a real browser to /procurement, reads the RESOLVED grid tracks of the
 * queue header and of every row, and reports the per-column left-edge drift
 * (row edge − header edge). Fails on any drift above TOLERANCE_PX.
 *
 *   pnpm ux-16:columns                      measure (exit 1 if drift > tolerance)
 *   UX16_SHOT=/path/shot.png pnpm ux-16:columns    also write a screenshot
 *
 * Why a served check: the bug is a CSS track-sizing bug (`1fr` = `minmax(auto,1fr)`,
 * so a row's min-content inflates its tracks while the short header labels don't) —
 * it only exists in the resolved layout, so a static source check can't see it.
 * `pnpm verify:ux-16` is the static guard that the fix stays in the source; this is
 * the measurement that proves the pixels. Needs the app + a seeded DB running, so
 * it is NOT part of `verify:all` (same contract as `pnpm a11y:scan`).
 *
 * Env: A11Y_BASE_URL (default http://localhost:3001) · A11Y_EMAIL · A11Y_PASSWORD.
 */
import { chromium } from "playwright";

const BASE = process.env.A11Y_BASE_URL ?? "http://localhost:3001";
const EMAIL = process.env.A11Y_EMAIL ?? "admin@axona-demo.test";
const PASSWORD = process.env.A11Y_PASSWORD ?? "axona-dev-2026!";
const SHOT = process.env.UX16_SHOT;
const VERBOSE = process.env.UX16_VERBOSE === "1";
/** Viewport the optional screenshot is taken at (the flagship 14" width). */
const SHOT_WIDTH = parseInt(process.env.UX16_SHOT_WIDTH ?? "1512", 10);
/** Sub-pixel rounding only — anything larger is a real column residual. */
const TOLERANCE_PX = 0.5;
/** The standard desktop widths the app is used at (last one = screenshot width). */
const WIDTHS = (process.env.UX16_WIDTHS ?? "1180,1280,1366,1440,1512,1728")
  .split(",")
  .map((w) => parseInt(w.trim(), 10))
  .filter((w) => Number.isFinite(w));

interface RowMeasurement {
  text: string;
  tracks: number[];
  edges: number[];
}
interface Measurement {
  error: string | null;
  cardWidth: number;
  header: { tracks: number[]; edges: number[] };
  rows: RowMeasurement[];
}

/**
 * Runs IN THE PAGE. Kept as a plain-JS string (not a TS callback) on purpose:
 * tsx/esbuild rewrites named callbacks with a `__name` helper that does not exist
 * in the browser context, so a typed `page.evaluate(fn)` throws `__name is not
 * defined`. A string expression is handed to the page verbatim.
 *
 * Finds the PO-queue card via its header row, then reports each grid's RESOLVED
 * track widths + the left edge of every track relative to the card.
 */
const BROWSER_MEASURE = `(() => {
  var grids = Array.prototype.slice.call(document.querySelectorAll('div')).filter(function (d) {
    return getComputedStyle(d).display === 'grid' && String(d.className).indexOf('grid-cols-[') !== -1;
  });
  var header = null;
  for (var i = 0; i < grids.length; i++) {
    if ((grids[i].textContent || '').trim().indexOf('PO') === 0) { header = grids[i]; break; }
  }
  var empty = { error: 'PO-queue header grid not found', cardWidth: 0, header: { tracks: [], edges: [] }, rows: [] };
  if (!header) return empty;
  var card = header.parentElement;
  if (!card) return empty;
  var rows = grids.filter(function (g) { return g !== header && g.parentElement === card; });
  if (!rows.length) { empty.error = 'no PO rows rendered'; return empty; }

  function round(n) { return Math.round(n * 100) / 100; }
  function tracks(el) {
    return getComputedStyle(el).gridTemplateColumns.split(' ').map(function (v) { return round(parseFloat(v)); });
  }
  // Left edge of each track, relative to the card (so padding + gap count).
  function edges(el) {
    var cs = getComputedStyle(el);
    var gap = parseFloat(cs.columnGap) || 0;
    var x = el.getBoundingClientRect().left - card.getBoundingClientRect().left + (parseFloat(cs.paddingLeft) || 0);
    return tracks(el).map(function (w) { var at = round(x); x += w + gap; return at; });
  }

  return {
    error: null,
    cardWidth: Math.round(card.getBoundingClientRect().width),
    header: { tracks: tracks(header), edges: edges(header) },
    rows: rows.map(function (r) {
      return {
        text: (r.textContent || '').replace(/\\s+/g, ' ').slice(0, 44),
        tracks: tracks(r),
        edges: edges(r)
      };
    })
  };
})()`;

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: WIDTHS[WIDTHS.length - 1] ?? 1512, height: 1100 },
  });

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  // Next dev compiles /login on first hit — let the form hydrate before typing,
  // or the controlled inputs swallow the fill and the submit posts empty.
  await page.waitForSelector("#login-email", { timeout: 60_000 });
  await page.waitForTimeout(1_500);
  await page.fill("#login-email", EMAIL);
  await page.fill("#login-password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), {
    timeout: 60_000,
    waitUntil: "commit",
  });
  await page.goto(`${BASE}/procurement`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 15_000 });
  await page.waitForTimeout(1200);

  console.log("\nUX.16 — Procurement PO-queue column alignment\n");
  let worstOverall = 0;
  let failed = false;

  // Sweep the standard widths: the fr tracks resolve differently at each, and the
  // residual only appears once a row's min-content exceeds its ratio share.
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 1100 });
    await page.waitForTimeout(400);
    const result = (await page.evaluate(BROWSER_MEASURE)) as Measurement;

    if (result.error) {
      console.log(`  ${width}px viewport — FAIL ${result.error}`);
      failed = true;
      continue;
    }

    let worst = 0;
    const offenders: string[] = [];
    for (const r of result.rows) {
      const drift = r.edges.map(
        (e, i) => Math.round((e - (result.header.edges[i] ?? 0)) * 100) / 100,
      );
      const max = Math.max(...drift.map(Math.abs));
      if (max > TOLERANCE_PX)
        offenders.push(`      [${drift.join(", ")}]  ${r.text}`);
      worst = Math.max(worst, max);
    }
    worstOverall = Math.max(worstOverall, worst);
    if (worst > TOLERANCE_PX) failed = true;

    console.log(
      `  ${worst > TOLERANCE_PX ? "DRIFT" : "  ok "} viewport ${String(width).padStart(4)}px · card ${String(result.cardWidth).padStart(4)}px · worst ${String(Math.round(worst * 100) / 100).padStart(6)}px`,
    );
    console.log(`         header tracks  ${result.header.tracks.join(" | ")}`);
    if (VERBOSE || offenders.length > 0) {
      for (const line of offenders.slice(0, 6)) console.log(line);
      if (offenders.length > 6)
        console.log(`      …and ${offenders.length - 6} more rows`);
    }
  }

  if (SHOT) {
    await page.setViewportSize({ width: SHOT_WIDTH, height: 1100 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: SHOT });
  }
  await browser.close();

  console.log(
    `\n  worst column residual across widths: ${Math.round(worstOverall * 100) / 100}px (tolerance ${TOLERANCE_PX}px) — ${failed ? "FAIL" : "PASS"}\n`,
  );
  process.exit(failed ? 1 : 0);
}

void main();
