/**
 * Verify AUDIT.4 — /audit rebuilt 1:1 against `Audit Trail.dc.html` (v8), with
 * CONF.1's ReliabilityPanel + calibrated confidence + approver preserved.
 * Run: pnpm verify:audit-4
 *
 *   1. The screen carries the mock's distinguishing regions: "Workspace · immutable
 *      log" eyebrow, Export CSV, the search bar, day-grouped rows, a module chip,
 *      and the centred 1000px column.
 *   2. CONF.1's ReliabilityPanel still renders with the org's calibration data.
 *   3. Rows render calibrated confidence + the raw-divergence hint + the uncal marker.
 *   4. UX.11 truncation holds (min-w-0 + truncate + title) and the filter bar is
 *      pinned below the topbar (UX.5); filters + search work.
 *   5. Read-only — no mutation path; low confidence flags in INK (no invented reds);
 *      v2 tokens only; no emoji; data-driven per org (no hardcoded narrative).
 *   6. The read model is org-scoped (a second org's trail is isolated).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;
const check = async (
  label: string,
  fn: () => boolean | Promise<boolean>,
): Promise<void> => {
  try {
    const ok = await fn();
    console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
    ok ? passed++ : failed++;
  } catch (e) {
    console.log(`  FAIL ${label} — ${(e as Error).message}`);
    failed++;
  }
};

const DEMO = "org_axona_demo";
const SECOND = "org_isolation_test";

async function run(): Promise<void> {
  console.log("\nVerifying AUDIT.4 — /audit against its v8 design\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const view = read("apps/web/components/audit/AuditView.tsx");
  const panel = read("apps/web/components/audit/ReliabilityPanel.tsx");
  // HIST.1 extracted the shared actor-avatar + CONF.1 confidence-badge markup into
  // audit-parts.tsx (used by BOTH AuditView and the RecordHistory timeline — one
  // renderer, no fork). The row-rendering assertions below therefore look at the
  // combined row source (the view + the extracted parts).
  const parts = read("apps/web/components/audit/audit-parts.tsx");
  const row = `${view}\n${parts}`;

  // ── 1: the mock's distinguishing regions ──
  await check(
    "v8 shell: 'Workspace · immutable log' eyebrow + Export CSV",
    () => {
      return /Workspace · immutable log/.test(view) && /Export CSV/.test(view);
    },
  );
  await check("search bar + day grouping + module chip + 1000px column", () => {
    return (
      /Search actor, action, or object/.test(view) &&
      /dayLabel|days\.map/.test(view) &&
      /moduleOf/.test(view) &&
      /max-w-\[1000px\]/.test(view)
    );
  });

  // ── 2: ReliabilityPanel preserved ──
  await check(
    "CONF.1 ReliabilityPanel still rendered with calibration data",
    () => {
      return (
        /import \{ ReliabilityPanel \}/.test(view) &&
        /<ReliabilityPanel calibration=\{data\.calibration\}/.test(view) &&
        /calibration\.bins|calibration\?\.sampleSize|calibration\.ece/.test(
          panel,
        )
      );
    },
  );

  // ── 3: calibrated confidence per row (rendering shared via audit-parts) ──
  await check("rows show calibrated value + raw hint + uncal marker", () => {
    return (
      /e\.calibrated/.test(row) &&
      /uncal/.test(row) &&
      /·raw/.test(row) &&
      /LOW_CONFIDENCE/.test(row) &&
      // AuditView still references the shared badge (no fork; it delegates)
      /ConfidenceCell/.test(view)
    );
  });

  // ── 4: truncation + sticky + filters ──
  await check("UX.11 truncation on cells + UX.5 pinned filter bar", () => {
    return (
      /min-w-0/.test(view) &&
      /truncate/.test(view) &&
      /title=\{e\.summary\}/.test(view) &&
      /sticky top-\[60px\]/.test(view)
    );
  });
  await check("filters + search wired (server filters + client search)", () => {
    return (
      /applyFilters/.test(view) &&
      /\/api\/audit\?/.test(view) &&
      /const visible =/.test(view)
    );
  });

  // ── 5: read-only · INK · tokens · data-driven ──
  await check(
    "read-only — no edit/delete path, no auditLog mutation in view",
    () => {
      return (
        !/onDelete|onEdit|Delete entry|Edit entry/.test(view) &&
        !/auditLog\.(create|update|updateMany|delete|deleteMany|upsert)/.test(
          view,
        )
      );
    },
  );
  await check("low confidence flags in INK; no invented reds", () => {
    return (
      /Review/.test(row) &&
      /bg-ink-strong/.test(row) &&
      !/\bbg-red|text-red|border-red\b/.test(row)
    );
  });
  await check(
    "v2 tokens only · no emoji · no hardcoded narrative (PROSPECT.2)",
    () => {
      return (
        !/#[0-9a-fA-F]{3,6}\b/.test(row) &&
        !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(row) &&
        !/Tier-1 Auto OEM|SN-2196|SN-2208|HX-2|SERVO-20|Nomagic/.test(view)
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP data checks — DATABASE_URL not set");
    if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
    else {
      console.log(`\nFAILED — ${failed} check(s) failed`);
      process.exit(1);
    }
    return;
  }

  const { prisma } = await import("@axona/db");
  const { getAuditTrail, getCalibration } =
    await import("../../apps/web/lib/audit-trail");

  // ── 2 (data): calibration data exists and rows carry calibrated confidence ──
  await check(
    "demo org has calibration + calibrated rows (data-driven)",
    async () => {
      const [cal, page] = await Promise.all([
        getCalibration(DEMO),
        getAuditTrail(DEMO),
      ]);
      return (
        cal !== null &&
        page.entries.length > 0 &&
        page.entries.some((e) => e.calibrated !== null)
      );
    },
  );

  // ── 6: org-scoping ──
  await check(
    "read model is org-scoped (second org's trail is isolated)",
    async () => {
      const demo = await getAuditTrail(DEMO);
      const other = await getAuditTrail(SECOND);
      const demoIds = new Set(demo.entries.map((e) => e.id));
      // no leakage: none of the second org's rows appear in the demo set
      return other.entries.every((e) => !demoIds.has(e.id));
    },
  );

  await prisma.$disconnect();

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run().then(() => process.exit(failed > 0 ? 1 : 0));
