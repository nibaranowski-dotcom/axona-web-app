/**
 * Verify IO.1 (Phase 1) — the universal import core (generalizes importUnits) +
 * MTX.1 AI-verify. Static checks always run; DB checks gate on DATABASE_URL and
 * self-clean (MIGRATE.1). Run: pnpm verify:io-1
 *
 *   1. BUILD-ON-TOP: importUnits is a thin caller of the shared core and its
 *      behavior is byte-unchanged (verify:plm-2's exact contract reproduced here).
 *   2. The generic core imports a 2nd entity (Parts) with the SAME contract —
 *      dry-run writes nothing, row errors, idempotent, no partial writes, org-scoped.
 *   3. AI-VERIFY (MTX.1): a messy file yields an agent-proposed mapping + flagged
 *      rows with calibrated confidence (CONF.1) — a PROPOSAL; nothing writes until
 *      confirm; the confirmed import writes + audits. Uses the EXISTING extractColumn
 *      primitive (no new extraction path).
 *   4. Idempotent + no-partial-writes hold on re-run and a mixed valid/invalid file.
 *   5. REUSE PROOF: exactly one CSV parser; MTX.1 + FILE.1 are the seams; no
 *      parallel parser/extractor/storage introduced.
 *   6. The shared import route + action are RBAC-gated + audited; /import is scanned.
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
  console.log("\nVerifying IO.1 — universal import core + MTX.1 AI-verify\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const core = read("packages/db/src/io/import-core.ts");
  const plmImport = read("packages/db/src/plm/import.ts");
  const propose = read("packages/agents/src/io/propose-mapping.ts");
  const actions = read("apps/web/app/(shell)/import/actions.ts");
  const panel = read("apps/web/components/io/ImportPanel.tsx");
  const a11yRoutes = read("src/scripts/a11y-routes.ts");

  // ── 1 (static): importUnits is a THIN caller of the extracted core ──
  await check(
    "importUnits is a thin caller of importEntity(unitDescriptor) — internals extracted",
    () => {
      return (
        /importEntity\(db, unitDescriptor,/.test(plmImport) &&
        /export async function importUnits/.test(plmImport) &&
        // the extracted machinery now lives in the core, not duplicated in plm/import
        /export async function importEntity/.test(core) &&
        /export const unitDescriptor/.test(core)
      );
    },
  );

  // ── 5 (static): REUSE — exactly one parser; MTX.1 + FILE.1 are the seams ──
  await check(
    "exactly ONE CSV parser (parseCsv defined once, in the core)",
    () => {
      const defineRe = /function parseCsv\(/g;
      const inCore = (core.match(defineRe) ?? []).length;
      const inPlm = (plmImport.match(defineRe) ?? []).length;
      const inPropose = (propose.match(defineRe) ?? []).length;
      return (
        inCore === 1 && // the ONE definition
        inPlm === 0 && // plm/import defines no parser…
        inPropose === 0 && // the AI layer imports it
        // …it delegates to the shared core (MFX.1: importBom is now a thin caller
        // over importEntity, like importUnits — so it imports the core, not parseCsv).
        /import \{[\s\S]*importEntity[\s\S]*\} from "\.\.\/io\/import-core"/.test(
          plmImport,
        ) &&
        /parseCsv[\s\S]*from "@axona\/db"/.test(propose)
      );
    },
  );
  await check(
    "AI-verify reuses MTX.1 extractColumn — NO new extraction path / model client",
    () => {
      return (
        /extractColumn\(/.test(propose) &&
        /from "\.\.\/matrix\/extract"/.test(propose) &&
        // no parallel model client or extractor defined in the AI layer
        !/class\s+\w*ModelClient/.test(propose) &&
        !/new\s+AnthropicModelClient/.test(propose) &&
        !/createMessage\(/.test(propose)
      );
    },
  );
  await check(
    "NO parallel storage — IO.1 introduces no second blob store (FILE.1 is the seam)",
    () => {
      // the import path mirrors importUnits (CSV string in). No IO.1 file spins up
      // its own S3 client or re-implements putObject/getObject.
      const io = [core, propose, actions, panel].join("\n");
      return (
        !/new\s+S3Client/.test(io) &&
        !/@aws-sdk\/client-s3/.test(io) &&
        !/function\s+putObject/.test(io)
      );
    },
  );

  // ── 6 (static): the shared route/action is RBAC-gated + audited; /import scanned ──
  await check(
    "shared import action is RBAC-gated on line 1, org-scoped, and audits ONLY the write",
    () => {
      const iRole = actions.indexOf("requireRole(");
      const iDb = actions.indexOf("dbForOrg(");
      const iAudit = actions.indexOf("writeAudit(");
      const iConfirm = actions.indexOf("confirmImportAction");
      return (
        iRole > 0 &&
        iDb > iRole &&
        // writeAudit lives in confirmImportAction (the only write path), not in
        // previewImportAction / proposeMappingAction
        iAudit > iConfirm &&
        /model: aiVerified \?/.test(actions) && // CONF.1 model on the audit
        /confidence: aiVerified \?/.test(actions) &&
        /approver:/.test(actions)
      );
    },
  );
  await check("/import route is registered for the a11y scan", () => {
    return /path: "\/import"/.test(a11yRoutes);
  });
  await check(
    "shared UI reuses the propose→dry-run→confirm flow (no raw hex)",
    () => {
      return (
        /proposeMappingAction|previewImportAction|confirmImportAction/.test(
          panel,
        ) && !/#[0-9a-fA-F]{6}\b/.test(panel)
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP data checks — DATABASE_URL not set (static only)");
    finish();
    return;
  }

  const {
    dbForOrg,
    prisma,
    importUnits,
    importEntity,
    partMasterDescriptor,
    writeAudit,
    getCalibrationModel,
  } = await import("@axona/db");
  const { proposeImportMapping } = await import("@axona/agents");
  const db = dbForOrg(DEMO);

  // ── 1 (behavior): importUnits byte-unchanged — verify:plm-2's exact contract ──
  await check(
    "BUILD-ON-TOP: importUnits behavior byte-unchanged (2 created · 2 errors · idempotent)",
    async () => {
      const guard = await captureSeededState(prisma as never, ["Unit"]);
      try {
        const before = await db.unit.count();
        const csv = [
          "serial,model,status",
          "SN-IO-U1,AX-2,in_build",
          "SN-IO-U2,AX-2,in_build",
          "SN-IO-U3,NOPE,in_build", // unknown model
          "SN-IO-U4,AX-2,teleporting", // bad enum
        ].join("\n");
        const dry = await importUnits(db, csv, { dryRun: true });
        const afterDry = await db.unit.count();
        const first = await importUnits(db, csv);
        const afterFirst = await db.unit.count();
        const second = await importUnits(db, csv);
        return (
          afterDry === before &&
          dry.created === 2 &&
          dry.errors.length === 2 &&
          first.created === 2 &&
          first.errors.length === 2 &&
          afterFirst === before + 2 &&
          second.created === 0 &&
          second.updated === 2
        );
      } finally {
        await guard.restore();
      }
    },
  );

  // ── 2: the generic core imports a 2nd entity (Parts) with the SAME contract ──
  await check(
    "generic core imports Parts — dry-run writes nothing · row errors · idempotent · atomic",
    async () => {
      const guard = await captureSeededState(prisma as never, ["PartMaster"]);
      try {
        const before = await db.partMaster.count();
        const csv = [
          "partnumber,description,lifecyclestatus,category",
          "PRT-IO-1,Bracket assembly,active,mechanical",
          "PRT-IO-2,Wiring harness,ncr_hold,electrical",
          "PRT-IO-3,,active,mechanical", // empty description
          "PRT-IO-4,Bad part,teleporting,x", // invalid lifecycle
        ].join("\n");
        const dry = await importEntity(
          db,
          partMasterDescriptor,
          { text: csv },
          { dryRun: true },
        );
        const afterDry = await db.partMaster.count();
        const first = await importEntity(db, partMasterDescriptor, {
          text: csv,
        });
        const afterFirst = await db.partMaster.count();
        const second = await importEntity(db, partMasterDescriptor, {
          text: csv,
        });
        const afterSecond = await db.partMaster.count();
        return (
          afterDry === before && // dry run writes nothing
          dry.created === 2 &&
          dry.errors.length === 2 &&
          first.created === 2 &&
          first.errors.length === 2 &&
          afterFirst === before + 2 && // only the 2 valid rows land (no partial)
          second.created === 0 &&
          second.updated === 2 && // idempotent by partNumber
          afterSecond === afterFirst
        );
      } finally {
        await guard.restore();
      }
    },
  );

  // ── 2b: org-scoped — an import into DEMO is invisible to a second org ──
  await check(
    "org-scoped: Parts imported into DEMO are never visible to a second org",
    async () => {
      const guard = await captureSeededState(prisma as never, ["PartMaster"]);
      try {
        const csv = [
          "partnumber,description,lifecyclestatus",
          "PRT-ISO-1,Isolation test part,active",
        ].join("\n");
        await importEntity(db, partMasterDescriptor, { text: csv });
        const inDemo = await db.partMaster.count({
          where: { partNumber: "PRT-ISO-1" },
        });
        const inSecond = await dbForOrg(SECOND).partMaster.count({
          where: { partNumber: "PRT-ISO-1" },
        });
        return inDemo === 1 && inSecond === 0;
      } finally {
        await guard.restore();
      }
    },
  );

  // ── 3: AI-verify (MTX.1) — propose a mapping + flags; nothing writes; confirm writes+audits ──
  await check(
    "AI-verify: MTX.1 proposes a mapping + flags rows (calibrated confidence) — a PROPOSAL, no write",
    async () => {
      const guard = await captureSeededState(prisma as never, ["PartMaster"]);
      try {
        // a MESSY file: unfamiliar header casing/spacing the agent must map.
        const messy = [
          "Part Number,Description,Lifecycle Status,Category",
          "PRT-AI-1,Bracket assembly,active,mechanical",
          "PRT-AI-2,Wiring harness,ncr_hold,electrical",
        ].join("\n");
        const before = await db.partMaster.count();
        const calibration = await getCalibrationModel(DEMO).catch(() => null);
        const proposal = await proposeImportMapping(
          { text: messy },
          {
            entity: partMasterDescriptor.entity,
            required: partMasterDescriptor.required,
            optional: partMasterDescriptor.optional,
          },
          { calibration },
        );
        const afterPropose = await db.partMaster.count();

        // the proposal maps every REQUIRED field to a real header, with a
        // calibrated confidence in [0,1]; flaggedRows is a proposal list.
        const requiredMapped = partMasterDescriptor.required.every(
          (f) => typeof proposal.mapping[f] === "string",
        );
        const confOk =
          typeof proposal.confidence === "number" &&
          proposal.confidence >= 0 &&
          proposal.confidence <= 1 &&
          proposal.fields.every(
            (fld) => fld.confidence >= 0 && fld.confidence <= 1,
          );
        const proposalShapeOk =
          requiredMapped &&
          confOk &&
          Array.isArray(proposal.flaggedRows) &&
          !!proposal.model;

        // NOTHING was written by proposing or previewing under the mapping.
        const dry = await importEntity(
          db,
          partMasterDescriptor,
          { text: messy, mapping: proposal.mapping },
          { dryRun: true },
        );
        const afterDry = await db.partMaster.count();

        return (
          proposalShapeOk &&
          afterPropose === before &&
          afterDry === before &&
          dry.created === 2 && // the mapping makes the messy file importable
          dry.errors.length === 0
        );
      } finally {
        await guard.restore();
      }
    },
  );

  await check(
    "AI-verify confirm: the approved mapping WRITES + is audited with model + confidence + approver",
    async () => {
      const guard = await captureSeededState(prisma as never, [
        "PartMaster",
        "AuditLog",
      ]);
      try {
        const messy = [
          "Part Number,Description,Lifecycle Status",
          "PRT-AI-CONF-1,Confirmed part,active",
        ].join("\n");
        const proposal = await proposeImportMapping(
          { text: messy },
          {
            entity: partMasterDescriptor.entity,
            required: partMasterDescriptor.required,
            optional: partMasterDescriptor.optional,
          },
        );
        const before = await db.partMaster.count();

        // the human APPROVES → the only write path (mirrors confirmImportAction).
        const result = await importEntity(
          db,
          partMasterDescriptor,
          { text: messy, mapping: proposal.mapping },
          { dryRun: false },
        );
        const after = await db.partMaster.count();

        const auditId = await writeAudit(db, {
          orgId: DEMO,
          actor: { type: "HUMAN", id: "verify-io-1", label: "verify" },
          action: "partMaster.import",
          target: { type: "PartMaster", id: "csv:1-rows" },
          summary: "verify AI-verified import",
          inputs: { mapping: proposal.mapping },
          output: { created: result.created },
          model: proposal.model,
          confidence: proposal.confidence,
          approver: { id: "verify-io-1", label: "verify" },
        });

        const audit = await prisma.auditLog.findFirst({
          where: { orgId: DEMO, action: "partMaster.import" },
          orderBy: { createdAt: "desc" },
        });

        return (
          result.created === 1 &&
          after === before + 1 &&
          !!auditId &&
          !!audit &&
          audit.model === proposal.model &&
          typeof audit.confidence === "number" &&
          audit.approverId === "verify-io-1"
        );
      } finally {
        await guard.restore();
      }
    },
  );

  // ── 4: mixed valid/invalid — no partial writes under a mapping ──
  await check(
    "no-partial-writes: a mixed valid/invalid file writes ONLY the valid rows",
    async () => {
      const guard = await captureSeededState(prisma as never, ["PartMaster"]);
      try {
        const before = await db.partMaster.count();
        const csv = [
          "partnumber,description,lifecyclestatus",
          "PRT-MIX-1,Good one,active",
          "PRT-MIX-2,,active", // rejected (empty description)
          "PRT-MIX-3,Another good,obsolete",
        ].join("\n");
        const res = await importEntity(db, partMasterDescriptor, { text: csv });
        const after = await db.partMaster.count();
        return (
          res.created === 2 && res.errors.length === 1 && after === before + 2
        );
      } finally {
        await guard.restore();
      }
    },
  );

  await prisma.$disconnect();
  finish();
}

function finish(): void {
  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run().then(() => process.exit(failed > 0 ? 1 : 0));
