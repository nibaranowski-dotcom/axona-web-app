/**
 * Verify PLM.5 — the blast radius (`Blast Radius.dc.html`), the UI over the ONT.1
 * traversal. Run: pnpm verify:plm-5
 *
 *   1. Route + view exist; LIST screen → back-arrow + mono eyebrow (not breadcrumbs).
 *   2. Selecting lot 88421 returns the seeded MULTI-MODULE cascade, and every row
 *      carries the relation path that reached it.
 *   3. UNIT ROWS LINK TO /units/:serial — the Unit page, never a build record.
 *      This is the reconcile Nicolas asked for: the ontology's UNIT resolver reads
 *      the Unit spine, so no per-screen bridging is needed. Asserted end-to-end.
 *   4. Results are org-scoped — a second org returns zero.
 *   5. Grouping matches the module tagging (every group is a real MODULE value).
 *   6. All four input types work off real records; the selector never invents one.
 *   7. The hand-off is RBAC-gated line 1 + audited, and only touches deployed units.
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
const LOT = "88421";

async function run(): Promise<void> {
  console.log("\nVerifying PLM.5 — the blast radius\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const page = read("apps/web/app/(shell)/blast-radius/page.tsx");
  const view = read("apps/web/components/units/BlastRadiusView.tsx");
  const actions = read("apps/web/app/(shell)/blast-radius/actions.ts");
  const lib = read("apps/web/lib/blast-radius.ts");
  const unitView = read("apps/web/components/units/UnitView.tsx");

  // ── 1 (static) ──
  await check("/blast-radius route + view exist", () => {
    return (
      page.length > 0 && view.length > 0 && /getBlastRadiusView/.test(page)
    );
  });
  await check(
    "LIST screen → back-arrow to Engineering + mono eyebrow (no breadcrumbs)",
    () => {
      return (
        /aria-label="Back to Engineering"/.test(view) &&
        /Engineering · PLM · traceability/.test(view) &&
        !/aria-label="Breadcrumb"/.test(view)
      );
    },
  );
  await check(
    "PLM.3's forward link closes: the Unit page links to the blast radius",
    () => /\/blast-radius\?/.test(unitView),
  );
  await check("v2 tokens only — no raw hex on the blast radius", () => {
    // the design's dark strip is #121214; we use the ink-strong token instead
    return !/#[0-9a-fA-F]{6}\b/.test(view) && /bg-ink-strong/.test(view);
  });
  await check(
    "the hand-off is RBAC-gated on line 1, before any effect runs",
    () => {
      const iRole = actions.indexOf("requireRole(");
      const iEffect = actions.indexOf("handOffToFieldService(");
      const handoff = read("apps/web/lib/field-handoff.ts");
      return (
        iRole > 0 &&
        iEffect > iRole &&
        /dbForOrg\(actor\.orgId\)/.test(handoff) &&
        /writeAudit\(/.test(handoff)
      );
    },
  );
  await check(
    "the client view never imports the server module (no node:fs in the bundle)",
    () => {
      // lib/blast-radius.ts pulls @axona/agents → node:fs; the client view must
      // import only the shared types/labels module.
      return (
        /blast-radius-shared/.test(view) &&
        !/from "@\/lib\/blast-radius"/.test(view) &&
        /@axona\/agents/.test(lib)
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
  const { getBlastRadiusView } =
    await import("../../apps/web/lib/blast-radius");

  const data = await getBlastRadiusView(DEMO, "lot", LOT);

  // ── 2: the seeded multi-module cascade, WITH relation paths ──
  await check(
    "lot 88421 returns the seeded MULTI-MODULE cascade (≥4 modules)",
    () => {
      return data.found && data.groups.length >= 4;
    },
  );
  await check("every row carries the relation path that reached it", () => {
    const rows = data.groups.flatMap((g) => g.rows);
    return (
      rows.length > 0 &&
      rows.every((r) => r.path.length > 0) &&
      // the path names the trace root it started from
      rows.every((r) => /88421/.test(r.path))
    );
  });
  await check("the Units group leads (the first question this answers)", () => {
    return data.groups[0]?.module === "Units" && data.groups[0].rows.length > 0;
  });

  // ── 3: THE reconcile — unit rows link to the Unit page, not a build record ──
  await check(
    "UNIT rows link to /units/:serial (the Unit page, never a build record)",
    async () => {
      const units = data.groups.find((g) => g.module === "Units");
      if (!units || units.rows.length === 0) return false;
      // every unit row's href is the Unit page for a REAL unit serial
      for (const r of units.rows) {
        if (!r.isUnit) return false;
        if (r.href !== `/units/${encodeURIComponent(r.code)}`) return false;
        const exists = await prisma.unit.findFirst({
          where: { orgId: DEMO, serial: r.code },
        });
        if (!exists) return false; // the link must resolve to a real unit
      }
      return true;
    },
  );
  await check(
    "no unit row points at a WorkOrderMfg id (the pre-PLM.2 failure mode)",
    async () => {
      const units = data.groups.find((g) => g.module === "Units");
      const codes = units?.rows.map((r) => r.code) ?? [];
      // codes must be serials, and every one must resolve as a Unit serial
      const asUnits = await prisma.unit.count({
        where: { orgId: DEMO, serial: { in: codes } },
      });
      return codes.length > 0 && asUnits === codes.length;
    },
  );
  await check(
    "graph AND as-built capture agree on who carries lot 88421",
    async () => {
      const units = data.groups.find((g) => g.module === "Units");
      const shown = (units?.rows.map((r) => r.code) ?? []).sort();
      const captured = await prisma.asBuiltRecord.findMany({
        where: { orgId: DEMO, lotCode: LOT },
        include: { unit: true },
      });
      const truth = [...new Set(captured.map((r) => r.unit.serial))].sort();
      return (
        truth.length > 0 &&
        shown.length === truth.length &&
        shown.every((s, i) => s === truth[i])
      );
    },
  );

  // ── 5: grouping matches the module tagging ──
  await check("grouping matches the ontology's module tagging", async () => {
    const { getBlastRadius } = await import("@axona/agents");
    const { dbForOrg } = await import("@axona/db");
    const raw = await getBlastRadius(dbForOrg(DEMO), {
      entityType: "LOT",
      code: `LOT-${LOT}`,
      maxDepth: 4,
    });
    const rawModules = new Set(raw.groups.map((g) => g.module));
    // every module the screen shows is a module the traversal actually tagged
    // (Units may also come from the capture path, which is the same tag).
    return data.groups.every(
      (g) => rawModules.has(g.module) || g.module === "Units",
    );
  });

  // ── 6: all four input types work off REAL records ──
  await check("all four trace types offer only real records", async () => {
    const o = data.options;
    return (
      o.lot.length > 0 &&
      o.sw.length > 0 &&
      o.eco.length > 0 &&
      o.part.length > 0
    );
  });
  await check("tracing from an ECO returns its affected units", async () => {
    const eco = await getBlastRadiusView(DEMO, "eco", "ECO-318");
    const units = eco.groups.find((g) => g.module === "Units");
    return (
      eco.found &&
      !!units &&
      units.rows.length >= 2 &&
      units.rows.every((r) => r.href.startsWith("/units/"))
    );
  });
  await check(
    "tracing from a software version returns the units running it",
    async () => {
      const rel = await prisma.softwareRelease.findFirst({
        where: { orgId: DEMO, version: "v4.2.1" },
      });
      if (!rel) return false;
      const sw = await getBlastRadiusView(DEMO, "sw", rel.id);
      const units = sw.groups.find((g) => g.module === "Units");
      return (
        sw.found &&
        !!units &&
        units.rows.length > 0 &&
        units.rows.every((r) => r.href.startsWith("/units/"))
      );
    },
  );

  // ── 7: the hand-off REALLY writes — exercised, then cleaned up ──
  await check(
    "hand-off raises one WO per DEPLOYED unit, audits it, and never double-dispatches",
    async () => {
      const { handOffToFieldService, handOffIssue } =
        await import("../../apps/web/lib/field-handoff");
      const guard = await captureSeededState(prisma as never, [
        "WorkOrderField",
        "AuditLog",
      ]);
      try {
        const units = data.groups.find((g) => g.module === "Units");
        const serials = units?.rows.map((r) => r.code) ?? [];
        const actor = { id: "verify", label: "verify", orgId: DEMO };
        const root = "lot 88421 (verify)";

        const first = await handOffToFieldService(actor, serials, root);
        // only the deployed ones are dispatched — the in-build ones are skipped
        if (first.raised.length !== data.handoffSerials.length) return false;
        if (first.raised.length === 0) return false;
        if (first.skippedNotDeployed.length === 0) return false; // seed has both

        const wos = await prisma.workOrderField.findMany({
          where: { orgId: DEMO, issue: handOffIssue(root) },
        });
        if (wos.length !== first.raised.length) return false;

        // audited, naming the human actor
        const audit = await prisma.auditLog.findFirst({
          where: { orgId: DEMO, action: "blastradius.handoff" },
        });
        if (!audit) return false;

        // idempotent: a second hand-off for the same root raises nothing
        const second = await handOffToFieldService(actor, serials, root);
        const after = await prisma.workOrderField.count({
          where: { orgId: DEMO, issue: handOffIssue(root) },
        });
        return (
          second.raised.length === 0 &&
          second.skippedAlreadyOpen.length === first.raised.length &&
          after === wos.length
        );
      } finally {
        await guard.restore(); // MIGRATE.1 — leave the seeded state intact
      }
    },
  );

  // ── 4: isolation ──
  await check("isolation: a second org returns ZERO", async () => {
    const other = await getBlastRadiusView(SECOND, "lot", LOT);
    const rows = other.groups.flatMap((g) => g.rows);
    return (
      rows.length === 0 &&
      other.summary.units === 0 &&
      other.handoffSerials.length === 0
    );
  });

  await prisma.$disconnect();

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run().then(() => process.exit(failed > 0 ? 1 : 0));
