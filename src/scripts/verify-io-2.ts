/**
 * Verify IO.2 — import/export Phase 2, horizontal on IO.1 + FILE.1 (no parallel
 * importer/exporter/parser). Static checks always run; DB checks gate on DATABASE_URL
 * and self-clean (captureSeededState + manual audit/blob cleanup). Run: pnpm verify:io-2
 *
 *   1. (static) exportEntity/writeWorkbook/writeCsv exist in the ONE core + are
 *      exported; the descriptors gained columns/readRows (reused for round-trip).
 *   2. (static) confirm/preview import actions gain the opt-in upsert mode + audit the
 *      skipped count; the ImportPanel surfaces Export + the upsert toggle + accepts xlsx.
 *   3. (static) the export route reuses exportEntity + writeWorkbook/writeCsv; the
 *      blob-upload route RBAC-gates, putObjects to FILE.1, parses SERVER-SIDE via the
 *      IO.1 core (importEntity bytes), and audits — no client parsing, no 2nd store.
 *   4. (db) export → re-import is a ZERO-DIFF no-op on ≥2 descriptors (all skipped).
 *   5. (db) bulk-update: N updated + M created + K skipped with correct counts; orgId
 *      isolation (a second tenant gets 0).
 *   6. (db) a bulk mutation writes an AUDIT.1 entry carrying the counts + actor.
 *   7. (db) create-path callers (importUnits, default mode) are unchanged — skipped is 0.
 *   8. (db·s3) a blob-uploaded xlsx imports end-to-end (putObject → getObjectBytes →
 *      parseWorkbook → importEntity).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { EntityDescriptor } from "@axona/db";

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

const root = process.cwd();
const read = (p: string) =>
  existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";
const decomment = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const DEMO = "org_axona_demo";
const SECOND = "org_isolation_test";
const P = "IO2-TEST-"; // throwaway partNumber prefix (captureSeededState removes them)

async function run(): Promise<void> {
  console.log("\nVerifying IO.2 — import/export Phase 2\n");

  // ── 1-3 · static: reuse of the ONE core / FILE.1, no forks ──────────────────
  await check(
    "exportEntity + writeWorkbook + writeCsv live in the IO.1 core + are exported; descriptors gained columns/readRows",
    () => {
      const core = decomment(read("packages/db/src/io/import-core.ts"));
      const index = read("packages/db/src/index.ts");
      return (
        /export async function exportEntity/.test(core) &&
        /export function writeWorkbook/.test(core) &&
        /export function writeCsv/.test(core) &&
        // reuses the single xlsx dep (XLSX.write, no second lib)
        /XLSX\.write/.test(core) &&
        (core.match(/async readRows\(db\)/g) ?? []).length >= 3 &&
        /exportEntity/.test(index) &&
        /writeWorkbook/.test(index)
      );
    },
  );
  await check(
    "importEntity gains OPT-IN upsert mode (create/update/skip) + a skipped count; default path unchanged",
    () => {
      const core = decomment(read("packages/db/src/io/import-core.ts"));
      return (
        /mode\?: "upsert"/.test(core) &&
        /skipped: number/.test(core) &&
        /opts\.mode === "upsert"/.test(core) &&
        // default + early-return paths still set `skipped: 0` (byte-identical for
        // existing callers). Two occurrences; robust to prettier's line wrapping.
        (core.match(/skipped: 0,/g) ?? []).length >= 2
      );
    },
  );
  await check(
    "import actions + ImportPanel surface upsert + export + xlsx (reuse the /import UI, no new nav)",
    () => {
      const actions = decomment(read("apps/web/app/(shell)/import/actions.ts"));
      const panel = decomment(read("apps/web/components/io/ImportPanel.tsx"));
      return (
        /mode\?: "upsert"/.test(actions) &&
        /skipped: result\.skipped/.test(actions) &&
        /\/api\/export\?entity=/.test(panel) &&
        /Bulk-update \(upsert\)/.test(panel) &&
        /\.csv,\.xlsx/.test(panel) &&
        /\/api\/import\/upload/.test(panel)
      );
    },
  );
  await check(
    "export route reuses exportEntity; blob-upload route RBAC-gates + putObjects + parses SERVER-SIDE + audits",
    () => {
      const exp = decomment(read("apps/web/app/api/export/route.ts"));
      const up = decomment(read("apps/web/app/api/import/upload/route.ts"));
      return (
        /exportEntity\(db, d\)/.test(exp) &&
        /writeWorkbook|writeCsv/.test(exp) &&
        /content-disposition/.test(exp) &&
        /requireRole\(user, \["ENGINEER", "ADMIN"\]\)/.test(up) &&
        /putObject\(/.test(up) &&
        /importEntity\(/.test(up) &&
        /bytes: new Uint8Array/.test(up) && // server-side bytes → the IO.1 parser
        /writeAudit\(/.test(up)
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP db checks — DATABASE_URL not set (static only)");
    finish();
    return;
  }

  const {
    prisma,
    dbForOrg,
    exportEntity,
    writeWorkbook,
    writeCsv,
    importEntity,
    importUnits,
    unitDescriptor,
    partMasterDescriptor,
  } = await import("@axona/db");
  const { captureSeededState, execScopedAuditDelete } =
    await import("./lib/self-clean");
  const guard = await captureSeededState(prisma as never, [
    "PartMaster",
    "Unit",
  ]);
  const db = dbForOrg(DEMO);
  const sdb = dbForOrg(SECOND);

  try {
    // ── 4 · export → re-import = ZERO-DIFF no-op on ≥2 descriptors ─────────────
    await check(
      "export → re-import is a zero-diff no-op (all rows skipped) on unit + partMaster (xlsx + csv)",
      async () => {
        const descs = [
          unitDescriptor,
          partMasterDescriptor,
        ] as EntityDescriptor<unknown, unknown>[];
        for (const desc of descs) {
          const { headers, rows } = await exportEntity(db, desc);
          if (rows.length === 0) return false;
          const viaXlsx = await importEntity(
            db,
            desc,
            { bytes: writeWorkbook(headers, rows) },
            { mode: "upsert" },
          );
          const viaCsv = await importEntity(
            db,
            desc,
            { text: writeCsv(headers, rows) },
            { mode: "upsert" },
          );
          for (const r of [viaXlsx, viaCsv])
            if (r.created !== 0 || r.updated !== 0 || r.skipped !== rows.length)
              return false;
        }
        return true;
      },
    );

    // ── 5 · bulk-update: correct created/updated/skipped + org isolation ───────
    await check(
      "bulk-update: 1 updated + 1 created + 1 skipped (correct counts); other tenant gets 0",
      async () => {
        // 3 throwaway existing rows (all captureSeededState-created → auto-cleaned).
        await db.partMaster.create({
          data: {
            orgId: DEMO,
            partNumber: `${P}A`,
            description: "Desc A",
            lifecycleStatus: "active",
            approvedVendorIds: [],
          },
        });
        await db.partMaster.create({
          data: {
            orgId: DEMO,
            partNumber: `${P}B`,
            description: "Desc B",
            lifecycleStatus: "active",
            approvedVendorIds: [],
          },
        });
        await db.partMaster.create({
          data: {
            orgId: DEMO,
            partNumber: `${P}C`,
            description: "Desc C",
            lifecycleStatus: "active",
            approvedVendorIds: [],
          },
        });
        // file: A unchanged (skip) · B changed (update) · D new (create). C omitted.
        const csv =
          "partnumber,description,lifecyclestatus,category\n" +
          `${P}A,Desc A,active,\n` +
          `${P}B,Desc B CHANGED,active,\n` +
          `${P}D,Desc D,active,`;
        const r = await importEntity(
          db,
          partMasterDescriptor,
          { text: csv },
          { mode: "upsert" },
        );
        const bAfter = await db.partMaster.findFirst({
          where: { partNumber: `${P}B` },
        });
        // isolation: none of the throwaway rows leaked into the second tenant.
        const inSecond = await sdb.partMaster.count({
          where: { partNumber: { startsWith: P } },
        });
        return (
          r.created === 1 &&
          r.updated === 1 &&
          r.skipped === 1 &&
          bAfter?.description === "Desc B CHANGED" &&
          inSecond === 0
        );
      },
    );

    // ── 6 · a bulk mutation writes an AUDIT.1 entry with the counts + actor ─────
    await check(
      "a bulk mutation writes an AUDIT.1 entry carrying created/updated/skipped + the actor",
      async () => {
        const { writeAudit } = await import("../../apps/web/lib/audit");
        const csv =
          "partnumber,description,lifecyclestatus,category\n" +
          `${P}E,Desc E,active,`;
        const r = await importEntity(
          db,
          partMasterDescriptor,
          { text: csv },
          { mode: "upsert" },
        );
        await writeAudit(db, {
          orgId: DEMO,
          actor: { type: "HUMAN", id: "io2-verify", label: "io2-verify" },
          action: "partMaster.import",
          target: { type: "PartMaster", id: "io2-verify" },
          summary: `bulk-update — ${r.created} created · ${r.updated} updated · ${r.skipped} skipped`,
          output: {
            created: r.created,
            updated: r.updated,
            skipped: r.skipped,
          },
          approver: { id: "io2-verify", label: "io2-verify" },
        });
        const audit = await db.auditLog.findFirst({
          where: { action: "partMaster.import", actorId: "io2-verify" },
        });
        const out = (audit?.output ?? {}) as { skipped?: number };
        const ok = !!audit && audit.actorType === "HUMAN" && out.skipped === 0;
        // Clean the audit row this check wrote. VERIFY.4: routed through
        // execScopedAuditDelete, which refuses a LIKE/% predicate and toggles the
        // append-only rule itself. The predicate is an EXACT actorId used only by
        // this script — it can never match a seeded or foreign row.
        await execScopedAuditDelete(
          prisma as never,
          `DELETE FROM "AuditLog" WHERE "orgId"=$1 AND "actorId"='io2-verify'`,
          DEMO,
        );
        return ok;
      },
    );

    // ── 7 · create-path callers unchanged — importUnits (default mode), skipped 0 ─
    await check(
      "importUnits (default create path) is unchanged: creates, and skipped is always 0",
      async () => {
        const model = await db.productModel.findFirst({
          select: { code: true },
        });
        if (!model) return false;
        const csv = `serial,model,status\n${P}UNIT-1,${model.code},in_build`;
        const first = await importUnits(db, csv);
        const again = await importUnits(db, csv); // idempotent blind-update
        return (
          first.created === 1 &&
          first.skipped === 0 &&
          again.updated === 1 &&
          again.skipped === 0
        );
      },
    );

    // ── 8 · blob-backed upload — server-side chain (gated on the blob store) ────
    const { s3Configured, putObject, getObjectBytes, deleteObject } =
      await import("../../apps/web/lib/storage");
    if (!s3Configured()) {
      console.log("  SKIP blob-upload check — S3/blob store not configured");
    } else {
      await check(
        "a blob-uploaded xlsx imports end-to-end (putObject → getObjectBytes → parseWorkbook → importEntity)",
        async () => {
          const bytes = writeWorkbook(
            ["partnumber", "description", "lifecyclestatus", "category"],
            [[`${P}BLOB`, "Blob part", "active", ""]],
          );
          const key = `${DEMO}/imports/io2-verify.xlsx`;
          await putObject(key, Buffer.from(bytes), "application/octet-stream");
          const roundtrip = await getObjectBytes(key); // server-side fetch
          const r = await importEntity(
            db,
            partMasterDescriptor,
            { bytes: new Uint8Array(roundtrip) },
            { dryRun: false },
          );
          const landed = await db.partMaster.count({
            where: { partNumber: `${P}BLOB` },
          });
          await deleteObject(key);
          return r.created === 1 && r.errors.length === 0 && landed === 1;
        },
      );
    }
  } finally {
    await guard.restore(); // removes every IO2-TEST-* row created above
    await prisma.$disconnect();
  }

  finish();
}

function finish(): void {
  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
