/**
 * Verify PLM.2 — the Unit registry (`Unit Registry.dc.html`). Static checks always
 * run; the data checks are gated on DATABASE_URL (they SKIP cleanly in CI, like
 * every other DB-gated verify). Run: pnpm verify:plm-2
 *
 *   1. The route + view + gated import action exist; requireRole is line 1 of the
 *      mutation; the empty state offers import (import-first).
 *   2. Filters COMPOSE — each alone narrows, and together they AND (never OR).
 *   3. The lot filter returns EXACTLY the units carrying that lot — cross-checked
 *      against the as-built capture records, not against itself.
 *   4. Filters are URL-addressable: the same filter object the page builds from
 *      searchParams produces the same rows.
 *   5. NO DRIFT: the registry's batch-resolved config for a real unit EQUALS
 *      resolveConfigAt(now) — the list path can never diverge from the Unit page.
 *   6. CSV import is idempotent (re-import = no-op) and reports malformed rows
 *      with NO partial writes; a dry run writes nothing at all.
 *   7. Per-tenant isolation: a second org's registry is empty.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { captureSeededState } from "./lib/self-clean";

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
  console.log("\nVerifying PLM.2 — the Unit registry\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  // ── 1 (static): route · view · gated action · import-first empty state ──
  const page = read("apps/web/app/(shell)/units/page.tsx");
  const view = read("apps/web/components/units/UnitRegistryView.tsx");
  const panel = read("apps/web/components/units/ImportUnitsPanel.tsx");
  const actions = read("apps/web/app/(shell)/units/actions.ts");

  await check("/units route + registry view + import panel exist", () => {
    return (
      page.length > 0 &&
      view.length > 0 &&
      panel.length > 0 &&
      /getUnitRegistry/.test(page)
    );
  });
  await check(
    "the import mutation is RBAC-gated on line 1 and org-scoped",
    () => {
      // requireRole must precede any dbForOrg / importUnits call.
      const iRole = actions.indexOf("requireRole(");
      const iDb = actions.indexOf("dbForOrg(");
      const iImport = actions.indexOf("importUnits(");
      return (
        iRole > 0 &&
        iDb > iRole &&
        iImport > iRole &&
        /writeAudit\(/.test(actions)
      );
    },
  );
  await check("a real (non-dry) import is audited; a dry run is not", () => {
    // the writeAudit call sits inside the `if (!dryRun)` block
    const guard = actions.indexOf("if (!dryRun)");
    const audit = actions.indexOf("writeAudit(");
    return guard > 0 && audit > guard;
  });
  await check("import-first: the empty state offers the CSV import", () => {
    return (
      /EmptyRegistry/.test(view) &&
      /ImportUnitsPanel/.test(view) &&
      /serial,model,status/.test(view)
    );
  });
  await check(
    "registry is distinct from Fleet — no map/telemetry artifact here",
    () => {
      // Fleet owns the deployment map + telemetry; the registry spans built AND
      // deployed and leads with the filterable table. Guard against the two
      // screens converging: no map component, no lat/lng, no telemetry read.
      return !/(FleetMap|MapView|Leaflet|mapbox|<Map\b|deployment map|telemetryPoint|\blat\b\s*[,:]|\blng\b\s*[,:])/i.test(
        view,
      );
    },
  );
  await check("v2 tokens only — no raw hex in the registry surfaces", () => {
    return ![view, panel].some((s) => /#[0-9a-fA-F]{6}\b/.test(s));
  });

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP data checks — DATABASE_URL not set");
    if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
    else {
      console.log(`\nFAILED — ${failed} check(s) failed`);
      process.exit(1);
    }
    return;
  }

  const { dbForOrg, prisma, resolveConfigAt, importUnits } =
    await import("@axona/db");
  const { getUnitRegistry } = await import("../../apps/web/lib/units");
  const db = dbForOrg(DEMO);

  const all = await getUnitRegistry(DEMO, {}, 1, 500);

  // ── 2: filters compose (AND, not OR) ──
  await check("filters compose — combined filters AND (never OR)", async () => {
    if (all.matched === 0) return false;
    const byModel = await getUnitRegistry(DEMO, { model: "HX-2" }, 1, 500);
    const byStatus = await getUnitRegistry(
      DEMO,
      { status: "deployed" },
      1,
      500,
    );
    const both = await getUnitRegistry(
      DEMO,
      { model: "HX-2", status: "deployed" },
      1,
      500,
    );
    const expected = byModel.rows.filter((r) =>
      byStatus.rows.some((s) => s.serial === r.serial),
    );
    return (
      byModel.matched > 0 &&
      byStatus.matched > 0 &&
      both.matched === expected.length &&
      both.matched <= Math.min(byModel.matched, byStatus.matched) &&
      both.rows.every((r) => r.modelCode === "HX-2" && r.status === "deployed")
    );
  });

  // ── 3: the lot filter is exact, cross-checked against the capture records ──
  await check(
    "lot 88421 returns EXACTLY the units whose as-built records carry it",
    async () => {
      const filtered = await getUnitRegistry(DEMO, { lot: "88421" }, 1, 500);
      // ground truth straight from the captured as-built rows
      const records = await db.asBuiltRecord.findMany({
        where: { lotCode: "88421" },
        include: { unit: true },
      });
      const truth = [...new Set(records.map((r) => r.unit.serial))].sort();
      const got = filtered.rows.map((r) => r.serial).sort();
      return (
        truth.length > 0 &&
        got.length === truth.length &&
        got.every((s, i) => s === truth[i]) &&
        // and the demo thread's unit really is in there
        got.includes("SN-2208")
      );
    },
  );

  // ── 4: URL-addressable — the searchParams shape drives the same result ──
  await check(
    "filters are URL-addressable (same params ⇒ same rows, page included)",
    async () => {
      const url = new URL(
        "http://x/units?model=HX-2&status=deployed&sw=v4.2.1&page=1",
      );
      const fromUrl = {
        model: url.searchParams.get("model") ?? undefined,
        status: url.searchParams.get("status") ?? undefined,
        sw: url.searchParams.get("sw") ?? undefined,
      };
      const a = await getUnitRegistry(DEMO, fromUrl, 1, 500);
      const b = await getUnitRegistry(
        DEMO,
        { model: "HX-2", status: "deployed", sw: "v4.2.1" },
        1,
        500,
      );
      return (
        a.matched > 0 &&
        a.matched === b.matched &&
        a.rows.map((r) => r.serial).join() ===
          b.rows.map((r) => r.serial).join()
      );
    },
  );

  // ── 5: the batch path must not drift from resolveConfigAt ──
  await check(
    "NO DRIFT: the registry's resolved config == resolveConfigAt(now) per unit",
    async () => {
      const sample = all.rows.slice(0, 8);
      if (sample.length === 0) return false;
      for (const row of sample) {
        const unit = await db.unit.findFirst({ where: { serial: row.serial } });
        if (!unit) return false;
        const single = await resolveConfigAt(db, unit.id, new Date());
        if ((single.configVersion?.name ?? null) !== row.configVersion)
          return false;
        if ((single.sw?.version ?? null) !== row.swVersion) return false;
      }
      return true;
    },
  );

  // ── 6: CSV import — dry run writes nothing; apply is idempotent + atomic ──
  await check(
    "CSV import: dry run writes NOTHING; apply is idempotent; bad rows never write",
    async () => {
      const guard = await captureSeededState(prisma as never, ["Unit"]);
      try {
        const before = await db.unit.count();
        const csv = [
          "serial,model,status",
          "SN-REG-1,HX-2,in_build",
          "SN-REG-2,HX-2,in_build",
          "SN-REG-3,NOPE,in_build", // unknown model
          "SN-REG-4,HX-2,teleporting", // bad enum
        ].join("\n");

        // dry run — reports the same shape, writes nothing
        const dry = await importUnits(db, csv, { dryRun: true });
        const afterDry = await db.unit.count();
        if (afterDry !== before) return false;
        if (dry.created !== 2 || dry.errors.length !== 2) return false;

        // apply — only the valid rows land
        const first = await importUnits(db, csv);
        const afterFirst = await db.unit.count();
        // re-apply — idempotent, no duplicates
        const second = await importUnits(db, csv);
        const afterSecond = await db.unit.count();

        return (
          first.created === 2 &&
          first.errors.length === 2 &&
          afterFirst === before + 2 && // ONLY the valid rows written
          second.created === 0 &&
          second.updated === 2 &&
          afterSecond === afterFirst
        );
      } finally {
        await guard.restore(); // MIGRATE.1 — leave the seeded state intact
      }
    },
  );

  // ── 7: per-tenant isolation ──
  await check("isolation: a second org's registry is empty", async () => {
    const other = await getUnitRegistry(SECOND, {}, 1, 500);
    return other.total === 0 && other.rows.length === 0;
  });

  await prisma.$disconnect();

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run().then(() => process.exit(failed > 0 ? 1 : 0));
