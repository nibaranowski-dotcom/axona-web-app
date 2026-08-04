/**
 * Verify PLM.13 — the BOM (as-designed) screen. Run: pnpm verify:plm-13
 *
 * Static checks always run; the data checks are gated on DATABASE_URL and SKIP
 * cleanly in CI-without-a-DB, like every other DB-gated verify.
 *
 *   1. Route + view + committed design exist; the screen breadcrumbs; the
 *      import-first surface reuses IO.1 rather than a second importer.
 *   2. The tree is MULTI-LEVEL and org-scoped: assemblies → sub-assemblies →
 *      parts, at least three levels deep.
 *   3. The revision selector RE-RESOLVES: each design revision returns its own
 *      tree, and they genuinely differ.
 *   4. The revision ladder is DERIVED, not stored: the driving ECO of a revision
 *      is the one recorded on the part revisions that revision introduced, and
 *      its effectivity is that ECO's own serial.
 *   5. The per-part expand deep-links (LINK.1): the part resolves to a route the
 *      app serves, and the ECO link resolves to a REAL change order.
 *   6. Leaves ≠ nodes: assemblies never reach build readiness / the as-built
 *      diff, and the flat readers are pinned to ONE design revision.
 *   7. Per-tenant isolation: a second org resolves no BOM for this model.
 *   8. v2 tokens only (no raw hex) and no invented reds.
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
const MODEL = "AX-2";

function finish(): void {
  if (failed === 0) console.log(`\nPASSED — ${passed} checks\n`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed\n`);
    process.exit(1);
  }
}

async function run(): Promise<void> {
  console.log("\nVerifying PLM.13 — BOM (as-designed) + revision history\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const page = read("apps/web/app/(shell)/bom/[model]/page.tsx");
  const view = read("apps/web/components/bom/BomView.tsx");
  const dbBom = read("packages/db/src/plm/bom.ts");
  const dcHtml = read("design/prototypes/axona-v2/BOM.dc.html");
  const configLib = read("apps/web/lib/configurations.ts");

  await check("route /bom/:model + view + committed design exist", () => {
    return (
      page.length > 0 &&
      view.length > 0 &&
      dcHtml.length > 0 &&
      /getBomView/.test(page) &&
      /Breadcrumb/.test(view)
    );
  });

  await check(
    "import-first reuses the IO.1 surface (no second importer)",
    () => {
      return (
        /href="\/import"/.test(view) &&
        !/importBom\(/.test(view) &&
        !/<input type="file"/.test(view)
      );
    },
  );

  await check(
    "revision + expanded position are URL state (addressable)",
    () => {
      return (
        /searchParams\?\.rev/.test(page) &&
        /searchParams\?\.position/.test(page) &&
        /URLSearchParams/.test(view)
      );
    },
  );

  await check("Configuration detail (PLM.11) now lands here", () => {
    return (
      /`\/bom\/\$\{encodeURIComponent\(config\.productModel\.code\)\}`/.test(
        configLib,
      ) && !/bomHref: "\/engineering"/.test(configLib)
    );
  });

  await check("v2 tokens only — no raw hex on the BOM surfaces", () => {
    return ![view, page].some((s) => /#[0-9a-fA-F]{6}\b/.test(s));
  });

  await check(
    "the leaf/revision rule lives in ONE place (packages/db/src/plm/bom.ts)",
    () => {
      // Every flat reader must go through leafOnly + an explicit design revision:
      // an assembly is not a purchasable part, and an unpinned query unions every
      // revision the moment a model has more than one.
      const readiness = read("packages/db/src/plm/build-readiness.ts");
      const config = read("packages/db/src/plm/config.ts");
      const capture = read("packages/db/src/plm/capture.ts");
      const asBuilt = read("apps/web/lib/as-built.ts");
      const mfg = read("apps/web/lib/manufacturing.ts");
      return (
        /export function leafOnly/.test(dbBom) &&
        [readiness, config, asBuilt, mfg].every((s) => /leafOnly\(/.test(s)) &&
        /designRevision:/.test(capture) &&
        [readiness, config, asBuilt, mfg].every((s) =>
          /designRevision:/.test(s),
        )
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP data checks — DATABASE_URL not set");
    finish();
    return;
  }

  const { getBomView } = await import("../../apps/web/lib/bom");
  const { dbForOrg, asDesignedLeaves, getBomTree, flattenTree } =
    await import("@axona/db");

  const view3 = await getBomView(DEMO, MODEL);
  if (!view3) {
    console.log("  FAIL no BOM view resolved for the seeded model");
    failed++;
    finish();
    return;
  }

  await check("the tree is multi-level (≥3 levels, real assemblies)", () => {
    const walk = (nodes: typeof view3.tree, depth: number): number[] =>
      nodes.flatMap((n) => [depth, ...walk(n.children, depth + 1)]);
    const depths = walk(view3.tree, 0);
    return (
      Math.max(...depths) >= 2 &&
      view3.assemblies >= 3 &&
      view3.tree.every((n) => n.isAssembly)
    );
  });

  await check(
    "the revision selector re-resolves — each revision has its own tree",
    async () => {
      if (view3.revisions.length < 2) return false;
      const trees = await Promise.all(
        view3.revisions.map((r) => getBomView(DEMO, MODEL, { rev: r.rev })),
      );
      const sigs = trees.map((t) =>
        JSON.stringify(
          (t?.tree ?? []).flatMap(function flat(n): string[] {
            return [
              `${n.position}:${n.partNumber}:${n.rev}`,
              ...n.children.flatMap(flat),
            ];
          }),
        ),
      );
      // every revision resolves something, and no two are identical
      return (
        sigs.every((s) => s.length > 2) && new Set(sigs).size === sigs.length
      );
    },
  );

  await check(
    "an older revision really is different content (not the same rows relabelled)",
    async () => {
      const current = await getBomView(DEMO, MODEL, {
        rev: view3.currentRev,
      });
      const oldest = await getBomView(DEMO, MODEL, {
        rev: view3.revisions[view3.revisions.length - 1]?.rev,
      });
      if (!current || !oldest) return false;
      return current.positions !== oldest.positions;
    },
  );

  await check(
    "the driving ECO + effectivity are a JOIN over real change orders",
    async () => {
      const db = dbForOrg(DEMO);
      const withEco = view3.revisions.filter((r) => r.ecoCode);
      if (withEco.length === 0) return false;
      for (const r of withEco) {
        const eco = await db.eCO.findFirst({
          where: { code: r.ecoCode as string },
          select: { code: true, effectiveFromSerial: true },
        });
        if (!eco) return false; // a caption, not a join
        if (r.effect !== `From ${eco.effectiveFromSerial}`) return false;
        if (r.ecoHref !== `/changes/${eco.code}`) return false;
      }
      return true;
    },
  );

  await check(
    "the change line is derived from the tree diff (names real positions)",
    () => {
      const bumped = view3.revisions.find((r) => /rev .+ → /.test(r.change));
      if (!bumped) return false;
      const position = bumped.change.split(" ")[0] as string;
      const flat = (nodes: typeof view3.tree): typeof view3.tree =>
        nodes.flatMap((n) => [n, ...flat(n.children)]);
      return flat(view3.tree).some((n) => n.position === position);
    },
  );

  await check("per-part expand deep-links resolve (LINK.1)", async () => {
    const db = dbForOrg(DEMO);
    const target = "A-14";
    const withPart = await getBomView(DEMO, MODEL, { position: target });
    const part = withPart?.part;
    if (!part) return false;
    // the part exists in the catalogue and its route is the LINK.1 one
    const pm = await db.partMaster.findFirst({
      where: { partNumber: part.partNumber },
      select: { partNumber: true },
    });
    // DEMO.6 #10 — the LINK.1 route now DEEP-LINKS the record on its module screen
    // (`/inventory?focus=<sku>`) instead of dropping the human on a bare list, which
    // was a soft dead-end. Assert the screen + the focused record, not a literal.
    if (
      !pm ||
      !part.inventoryHref.startsWith("/inventory") ||
      !part.inventoryHref.includes(
        `focus=${encodeURIComponent(part.partNumber)}`,
      )
    )
      return false;
    // the ECO link points at a REAL change order's detail route
    if (!part.ecoCode || !part.ecoHref) return false;
    const eco = await db.eCO.findFirst({
      where: { code: part.ecoCode },
      select: { code: true },
    });
    return !!eco && part.ecoHref === `/changes/${eco.code}`;
  });

  await check(
    "superseded-by is derived from a SUPERSEDE-class ECO, not a caption",
    async () => {
      const db = dbForOrg(DEMO);
      const withPart = await getBomView(DEMO, MODEL, { position: "A-14" });
      const s = withPart?.part?.supersededBy;
      if (!s) return false;
      const code = s.match(/\(([^)]+)\)/)?.[1];
      if (!code) return false;
      const eco = await db.eCO.findFirst({
        where: { code, changeClass: "SUPERSEDE" },
        select: { code: true },
      });
      const successor = s.split(" ")[0] as string;
      const pm = await db.partMaster.findFirst({
        where: { partNumber: successor },
        select: { partNumber: true },
      });
      return !!eco && !!pm;
    },
  );

  await check(
    "assemblies never reach the flat readers (leaves only, one revision)",
    async () => {
      const db = dbForOrg(DEMO);
      const model = await db.productModel.findFirst({
        where: { code: MODEL },
        select: { id: true, designRevision: true },
      });
      if (!model) return false;
      const nodes = flattenTree(
        await getBomTree(db, model.id, model.designRevision),
      );
      const leaves = await asDesignedLeaves(db, model.id, model.designRevision);
      const assemblies = nodes.filter((n) => n.children.length > 0);
      if (assemblies.length === 0) return false; // nothing being excluded ⇒ vacuous
      const leafPositions = new Set(leaves.map((l) => l.position));
      return (
        assemblies.every((a) => !leafPositions.has(a.position)) &&
        leaves.length + assemblies.length === nodes.length
      );
    },
  );

  await check(
    "per-tenant isolation: a second org resolves no BOM",
    async () => {
      const other = await getBomView(SECOND, MODEL);
      return other === null || other.empty || other.positions === 0;
    },
  );

  finish();
}

run();
