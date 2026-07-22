/**
 * Verify PLM.4 — the as-built diff (`As-Built Diff.dc.html`). Answers Q1: "the
 * same robot is not actually the same." Run: pnpm verify:plm-4
 *
 *   1. Route + view exist; DETAIL screen → full breadcrumbs; the Unit page (PLM.3)
 *      links here (closing PLM.3's forward link).
 *   2. EVERY BOM position appears EXACTLY ONCE — no dropped, no duplicated line.
 *   3. Substitutions are flagged, and SN-2208 shows the SERVO-204 rev-B
 *      substitution carrying lot 88421.
 *   4. Matched lines are de-emphasised (the eye lands on the divergence).
 *   5. SUBSTITUTIONS RENDER IN INK, NEVER RED — no red token, no raw hex, no
 *      error styling anywhere on this screen (brand invariant + "substitution is
 *      the normal case", never an error state).
 *   6. Expanding a position surfaces the CAPTURED who · when · why, and the lot
 *      deep-links into the blast radius.
 *   7. Per-tenant isolation.
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
const SERIAL = "SN-2208";

async function run(): Promise<void> {
  console.log("\nVerifying PLM.4 — the as-built diff\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const page = read("apps/web/app/(shell)/units/[serial]/as-built/page.tsx");
  const view = read("apps/web/components/units/AsBuiltDiffView.tsx");
  const unitView = read("apps/web/components/units/UnitView.tsx");

  // ── 1 (static) ──
  await check("/units/:serial/as-built route + diff view exist", () => {
    return page.length > 0 && view.length > 0 && /getAsBuiltView/.test(page);
  });
  await check("DETAIL screen → full breadcrumb trail to this unit", () => {
    return (
      /aria-label="Breadcrumb"/.test(view) &&
      /Unit registry/.test(view) &&
      /As-built diff/.test(view)
    );
  });
  await check(
    "PLM.3's forward link closes: the Unit page links to the as-built diff",
    () => /\/as-built/.test(unitView),
  );

  // ── 5 (static): never red — the brand invariant this screen is most at risk of ──
  await check(
    "substitutions render in INK, never red (no red token / hex / error styling)",
    () => {
      const redish =
        /\b(text|bg|border|ring|fill|stroke)-(red|rose|danger|error|destructive)\b/i;
      const rawHex = /#[0-9a-fA-F]{6}\b/;
      const cssRed = /\b(crimson|firebrick|indianred)\b/i;
      return !redish.test(view) && !rawHex.test(view) && !cssRed.test(view);
    },
  );
  await check("matched lines are de-emphasised (not hidden, not equal)", () => {
    // the non-substitution branch dims the row
    return /opacity-60/.test(view) && /Matched \(de-emphasised\)/.test(view);
  });
  await check(
    "expanding a position shows captured who · when · why + a lot deep-link",
    () => {
      return (
        /Reason/.test(view) &&
        /Who · when/.test(view) &&
        /blast-radius\?type=lot/.test(view) &&
        // the reason must come from the captured record, never invented
        /row\.reason/.test(view)
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

  const { dbForOrg, prisma } = await import("@axona/db");
  const { getAsBuiltView } = await import("../../apps/web/lib/as-built");
  const db = dbForOrg(DEMO);

  const data = await getAsBuiltView(DEMO, SERIAL);
  if (!data) {
    console.log(`  FAIL ${SERIAL} not found — run the seed`);
    process.exit(1);
  }

  // ── 2: every position exactly once ──
  await check(
    "every BOM position appears EXACTLY once (none dropped, none duplicated)",
    async () => {
      const unit = await db.unit.findFirst({ where: { serial: SERIAL } });
      if (!unit) return false;
      const bom = await db.bomLine.findMany({
        where: { productModelId: unit.productModelId },
      });
      const built = await db.asBuiltRecord.findMany({
        where: { unitId: unit.id },
      });
      const expected = [
        ...new Set([
          ...bom.map((b) => b.position),
          ...built.map((b) => b.bomPosition),
        ]),
      ].sort();
      const got = data.rows.map((r) => r.position).sort();
      const noDupes = new Set(got).size === got.length;
      return (
        noDupes &&
        got.length === expected.length &&
        got.every((p, i) => p === expected[i]) &&
        data.summary.positions === expected.length
      );
    },
  );

  // ── 3: the demo thread's substitution is flagged, with its lot ──
  await check(
    "SN-2208 flags the SERVO-204 rev-B substitution carrying lot 88421",
    () => {
      const row = data.rows.find(
        (r) =>
          r.isSubstitution &&
          r.built?.partNumber === "SERVO-204" &&
          r.built?.rev === "B",
      );
      return (
        !!row &&
        row.lotCode === "88421" &&
        row.designed?.rev === "C" && // designed rev C, built rev B
        row.lotQuarantined === true && // cross-checked, not hardcoded
        row.flag === "flagged-lot"
      );
    },
  );
  await check(
    "the flagged lot is derived from the part's quality hold, not hardcoded",
    () => {
      const lib = read("apps/web/lib/as-built.ts");
      return (
        /lifecycleStatus/.test(lib) &&
        !/88421/.test(lib) && // no lot number baked into the logic
        /ncr_hold|quarantin/.test(lib)
      );
    },
  );
  await check("every substitution carries its captured reason", () => {
    const subs = data.rows.filter((r) => r.isSubstitution);
    return subs.length > 0 && subs.every((r) => !!r.reason);
  });
  await check("summary numbers reconcile with the rows", () => {
    const subs = data.rows.filter((r) => r.isSubstitution).length;
    return (
      data.summary.substitutions === subs &&
      data.summary.matching === data.summary.positions - subs &&
      data.summary.positions === data.rows.length
    );
  });

  // ── 7: isolation ──
  await check("isolation: a second org cannot read this diff", async () => {
    return (await getAsBuiltView(SECOND, SERIAL)) === null;
  });

  await prisma.$disconnect();

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run().then(() => process.exit(failed > 0 ? 1 : 0));
