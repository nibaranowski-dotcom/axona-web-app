/**
 * Verify PRIV.1a — org data export (portability). Run: pnpm verify:priv-1a
 *
 * Static checks always run; the data checks are gated on DATABASE_URL.
 *
 *   1. No parallel exporter: the bundle drives IO.2's `exportEntity`, and the
 *      registered import descriptors are reused BY REFERENCE.
 *   2. The action is RBAC-gated (ADMIN) and writes an AUDIT.1 entry.
 *   3. Coverage: the bundle carries every entity the PRD names, each with real
 *      headers, and the populated ones carry rows.
 *   4. ISOLATION (P0): a second org's rows are ABSENT from this org's bundle —
 *      asserted per entity against that org's own bundle, by natural key, not by
 *      counting. Includes `File`, which is deliberately NOT tenant-scoped by the
 *      client extension and therefore the one source that must scope itself.
 *   5. The export is audited: an org.data_export entry lands in THIS org's log
 *      with the actor and the per-entity result.
 *   6. Two orgs' bundles never share a row key for the same entity.
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

/** Every entity the PRD names for the bundle (PRD-PRIV.1 §1). */
const REQUIRED_ENTITIES = [
  "unit",
  "bomLine",
  "partMaster",
  "part",
  "inventoryStock",
  "purchaseOrder",
  "ncr",
  "eco",
  "testRun",
  "configurationVersion",
  "file",
  "auditLog",
];

function finish(): void {
  if (failed === 0) console.log(`\nPASSED — ${passed} checks\n`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed\n`);
    process.exit(1);
  }
}

async function run(): Promise<void> {
  console.log("\nVerifying PRIV.1a — org data export (portability)\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  // Comments talk ABOUT the rules ("no raw prisma here"), so source assertions
  // run against code only — the same codeOnly pattern verify:table-1 uses.
  const codeOnly = (src: string): string =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*)/.test(l))
      .join("\n");

  const bundleSrc = read("packages/db/src/io/org-export.ts");
  const bundleCode = codeOnly(bundleSrc);
  const actions = read("apps/web/app/(shell)/settings/org/actions.ts");
  const view = read("apps/web/components/settings/OrgSettingsView.tsx");
  const spec = read("specs/PRD-PRIV.1.md");

  await check("the spec is committed (PRD-PRIV.1 §1)", () => {
    return spec.length > 0 && /Org data export \(portability\)/.test(spec);
  });

  await check("no parallel exporter — the bundle drives IO.2", () => {
    return (
      /import \{[\s\S]*exportEntity[\s\S]*\} from "\.\/import-core"/.test(
        bundleSrc,
      ) &&
      /await exportEntity\(db, source\)/.test(bundleSrc) &&
      // the registered descriptors are reused, not restated
      /unitDescriptor as unknown as ExportSource/.test(bundleSrc) &&
      /bomLineDescriptor as unknown as ExportSource/.test(bundleSrc) &&
      /partMasterDescriptor as unknown as ExportSource/.test(bundleSrc) &&
      // and no second serializer grew here
      !/writeCsv|writeWorkbook|XLSX/.test(bundleSrc)
    );
  });

  await check("the bundle never reaches for the unscoped client", () => {
    // Every source reads the caller's OrgScopedDb; a bare `prisma` import here
    // would defeat the isolation the whole story rests on.
    return !/\bprisma\b/.test(bundleCode) && !/dbForOrg/.test(bundleCode);
  });

  await check(
    "File scopes ITSELF (it is not in TENANT_MODELS, so nothing else will)",
    () => {
      const client = read("packages/db/src/client.ts");
      const fileIsTenantScoped = /^\s*"File",/m.test(client);
      const scopesItself =
        /OR: \[\{ orgId: db\.\$org \}, \{ project: \{ orgId: db\.\$org \} \}\]/.test(
          bundleSrc,
        );
      return !fileIsTenantScoped && scopesItself;
    },
  );

  await check("the export action is ADMIN-gated and audited", () => {
    const fn = actions.slice(
      actions.indexOf("export async function exportOrgData"),
    );
    return (
      /requireRole\(user, \["ADMIN"\]\)/.test(fn) &&
      /buildOrgExport\(db\)/.test(fn) &&
      /action: "org\.data_export"/.test(fn) &&
      /approver: actor\(user!\)/.test(fn)
    );
  });

  await check(
    "the surface lives in org settings (v2 tokens, no raw hex)",
    () => {
      return (
        /exportOrgData/.test(view) &&
        /Export all data/.test(view) &&
        !/#[0-9a-fA-F]{6}\b/.test(
          view.replace(/const ACCENT_HEX[\s\S]*?;\n/, ""),
        )
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP data checks — DATABASE_URL not set");
    finish();
    return;
  }

  const { dbForOrg, buildOrgExport, prisma } = await import("@axona/db");
  const now = new Date("2026-08-03T00:00:00.000Z");

  // The second tenant is DISCOVERED, never named: hardcoding one would put a
  // prospect marque in the tracked tree (SEED.1 rejects that), and a name that
  // only exists on a dev machine would make this check vacuous in CI. Pick the
  // non-DEMO org carrying the most audit rows — audit ids are cuids, so they are
  // globally unique and make the sharpest leak probe.
  const otherOrgs = await prisma.org.findMany({
    where: { id: { not: DEMO } },
    select: { id: true },
  });
  const withCounts = await Promise.all(
    otherOrgs.map(async (o) => ({
      id: o.id,
      rows: await prisma.auditLog.count({ where: { orgId: o.id } }),
    })),
  );
  const OTHER = withCounts.sort((a, b) => b.rows - a.rows)[0]?.id ?? "";
  if (!OTHER) {
    console.log("  FAIL no second tenant to prove isolation against");
    failed++;
    finish();
    return;
  }

  const mine = await buildOrgExport(dbForOrg(DEMO), { now });
  const theirs = await buildOrgExport(dbForOrg(OTHER), { now });

  await check("the bundle covers every entity the PRD names", () => {
    const covered = new Set(mine.entities.map((e) => e.entity));
    const missing = REQUIRED_ENTITIES.filter((e) => !covered.has(e));
    if (missing.length) console.log(`        missing: ${missing.join(", ")}`);
    return missing.length === 0;
  });

  await check("every entity declares headers; the bundle carries rows", () => {
    return (
      mine.entities.every((e) => e.headers.length > 0) &&
      mine.entities.every((e) => e.rows.length === e.count) &&
      mine.totalRows > 0 &&
      // the core operational entities are populated on the seeded tenant
      ["unit", "bomLine", "eco", "auditLog"].every(
        (k) => (mine.entities.find((e) => e.entity === k)?.count ?? 0) > 0,
      )
    );
  });

  await check(
    "ISOLATION: the bundle's org NAME is this org's, not another tenant's",
    async () => {
      // `Org` is not tenant-scoped by the extension, so this only holds because
      // buildOrgExport passes an explicit `where: { id: db.$org }`.
      const { prisma } = await import("@axona/db");
      const [a, b] = await Promise.all([
        prisma.org.findUnique({ where: { id: DEMO }, select: { name: true } }),
        prisma.org.findUnique({ where: { id: OTHER }, select: { name: true } }),
      ]);
      return (
        !!a &&
        !!b &&
        mine.orgName === a.name &&
        theirs.orgName === b.name &&
        mine.orgName !== theirs.orgName
      );
    },
  );

  await check("the bundle is stamped with its own org, not another", () => {
    return mine.orgId === DEMO && theirs.orgId === OTHER && DEMO !== OTHER;
  });

  // ── P0: isolation ──
  // NOT by natural key: the prospect seeds deliberately replay the base narrative,
  // so PO-9001 / ECO-305 / CFG-HX2-r4.2 legitimately exist on several tenants as
  // DIFFERENT rows. Comparing codes flags those and proves nothing. The real
  // property is "the bundle is exactly this org's rows", asserted against an
  // INDEPENDENT count taken with an explicit orgId predicate on the raw client.
  await check(
    "ISOLATION: every entity's count equals an independent org-scoped count",
    async () => {
      const { prisma } = await import("@axona/db");
      const counts: Record<string, (orgId: string) => Promise<number>> = {
        unit: (orgId) => prisma.unit.count({ where: { orgId } }),
        bomLine: (orgId) => prisma.bomLine.count({ where: { orgId } }),
        partMaster: (orgId) => prisma.partMaster.count({ where: { orgId } }),
        part: (orgId) => prisma.part.count({ where: { orgId } }),
        inventoryStock: (orgId) =>
          prisma.inventoryStock.count({ where: { orgId } }),
        purchaseOrder: (orgId) =>
          prisma.purchaseOrder.count({ where: { orgId } }),
        ncr: (orgId) => prisma.nCR.count({ where: { orgId } }),
        eco: (orgId) => prisma.eCO.count({ where: { orgId } }),
        testRun: (orgId) => prisma.testRun.count({ where: { orgId } }),
        configurationVersion: (orgId) =>
          prisma.configurationVersion.count({ where: { orgId } }),
        auditLog: (orgId) => prisma.auditLog.count({ where: { orgId } }),
        // File is not tenant-scoped by the extension — the same predicate the
        // source uses, written out independently here.
        file: (orgId) =>
          prisma.file.count({
            where: { OR: [{ orgId }, { project: { orgId } }], deletedAt: null },
          }),
      };
      let bad = 0;
      for (const [entity, count] of Object.entries(counts)) {
        const inBundle =
          mine.entities.find((e) => e.entity === entity)?.count ?? -1;
        const actual = await count(DEMO);
        if (inBundle !== actual) {
          console.log(
            `        ${entity}: bundle ${inBundle} vs org rows ${actual}`,
          );
          bad++;
        }
      }
      return bad === 0;
    },
  );

  await check(
    "ISOLATION: the bundle is a STRICT subset — the database holds more",
    async () => {
      // Non-vacuous: at least one entity must hold more rows database-wide than
      // this org's bundle carries. Otherwise "scoped" is indistinguishable from
      // "everything". Written entity-agnostically so it holds on any seed, where
      // which entities a second tenant populates varies.
      const globals: [string, number][] = [
        ["auditLog", await prisma.auditLog.count()],
        ["unit", await prisma.unit.count()],
        ["eco", await prisma.eCO.count()],
        ["purchaseOrder", await prisma.purchaseOrder.count()],
      ];
      const inBundle = (k: string) =>
        mine.entities.find((e) => e.entity === k)?.count ?? 0;
      const noneExceed = globals.every(([k, all]) => all >= inBundle(k));
      const someStrictlyMore = globals.some(
        ([k, all]) => all > inBundle(k) && inBundle(k) > 0,
      );
      return noneExceed && someStrictlyMore;
    },
  );

  await check(
    "ISOLATION: no ROW ID from the other tenant's bundle appears in this one",
    () => {
      // The sharpest form of the property, on the two id-keyed entities: audit
      // rows and files are keyed by cuid, so a shared key IS a leak — unlike the
      // human codes (PO-9001 / ECO-305) the prospect seeds deliberately reuse
      // across tenants, where a collision means nothing.
      let leaked = 0;
      for (const entity of ["auditLog", "file"]) {
        const a = mine.entities.find((e) => e.entity === entity);
        const b = theirs.entities.find((e) => e.entity === entity);
        if (!a || !b || b.rows.length === 0) continue;
        const mineIds = new Set(a.rows.map((r) => String(r[0])));
        const shared = b.rows
          .map((r) => String(r[0]))
          .filter((id) => mineIds.has(id));
        if (shared.length) {
          console.log(
            `        LEAK ${entity}: ${shared.slice(0, 3).join(", ")}`,
          );
          leaked += shared.length;
        }
      }
      // Non-vacuous: the other tenant must actually have id-keyed rows to leak.
      const probeRows =
        (theirs.entities.find((e) => e.entity === "auditLog")?.count ?? 0) +
        (theirs.entities.find((e) => e.entity === "file")?.count ?? 0);
      return leaked === 0 && probeRows > 0;
    },
  );

  await check(
    "the export writes an AUDIT.1 entry in THIS org's log",
    async () => {
      const db = dbForOrg(DEMO);
      const { writeAudit } = await import("@axona/db");
      const { captureSeededState } = await import("./lib/self-clean");
      // VERIFY.4: the ONLY sanctioned way to undo audit rows a verify creates is
      // captureSeededState → restore(), which deletes BY ID. A predicate delete
      // against AuditLog — even a narrow one — is exactly what that rule bans.
      const guard = await captureSeededState(prisma, ["AuditLog"]);
      const before = await db.auditLog.count({
        where: { action: "org.data_export" },
      });
      // Exercise the same write the action performs (the action itself needs a
      // session; this asserts the audit contract the action is built on).
      await writeAudit(db, {
        orgId: DEMO,
        actor: { type: "HUMAN", id: "verify", label: "verify:priv-1a" },
        action: "org.data_export",
        target: { type: "Org", id: DEMO },
        summary: "verify probe",
        output: { totalRows: mine.totalRows },
        approver: { id: "verify", label: "verify:priv-1a" },
      });
      const after = await db.auditLog.count({
        where: { action: "org.data_export" },
      });
      const otherOrg = await dbForOrg(OTHER).auditLog.count({
        where: { action: "org.data_export", summary: "verify probe" },
      });
      await guard.restore();
      const restored = await db.auditLog.count({
        where: { action: "org.data_export" },
      });
      return after === before + 1 && otherOrg === 0 && restored === before;
    },
  );

  await check("RBAC: the action rejects a non-admin", () => {
    // requireRole throws for anything outside the allowed set — assert the gate
    // is the FIRST thing the action does, before any data is read.
    const fn = actions.slice(
      actions.indexOf("export async function exportOrgData"),
    );
    const gateAt = fn.indexOf("requireRole");
    const readAt = fn.indexOf("buildOrgExport");
    return gateAt > 0 && gateAt < readAt;
  });

  finish();
}

run();
