import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { extname, isAbsolute, resolve } from "node:path";
import bcrypt from "bcryptjs";
import {
  prisma,
  dbForOrg,
  putObject,
  s3Configured,
  ensureBucket,
  ingestMemory,
  reindex,
  calibrate,
  type ProspectConfig,
  type OrgScopedDb,
} from "@axona/db";

// SEED.5 — the runner no longer loads any domain seed. A prospect config imports the
// generator it wants directly (`packages/db/prisma/seed/domain` for the pack-driven
// backdrop, or `…/seed/tenant` to opt into the old shared base) and calls it inside its
// own seed(), so the industry vocabulary is the CONFIG's choice, never the runner's.

// DEMO.6 #4 — CONF.1 needs a decided-proposal history to fit from, and prospect
// tenants had none (0 CalibrationModel rows → every confidence rendered "uncal").
// Loaded through the same computed-specifier trick as the tenant seed, for the same
// reason: keep the seed's deps out of src/scripts's tsc program.
type SeedCalibrationHistory = (
  db: OrgScopedDb,
  orgId: string,
  bands: { raw: number; approvalRate: number; count: number }[],
  opts: { prefix: string; startDaysAgo?: number; nowMs: number },
) => Promise<number>;
const CALIBRATION_SEED_MODULE = "../../../packages/db/prisma/seed/calibration";
async function loadCalibrationSeed(): Promise<{
  seed: SeedCalibrationHistory;
  bands: { raw: number; approvalRate: number; count: number }[];
}> {
  const mod = (await import(CALIBRATION_SEED_MODULE)) as {
    seedCalibrationHistory: SeedCalibrationHistory;
    PROSPECT_CALIBRATION: {
      raw: number;
      approvalRate: number;
      count: number;
    }[];
  };
  return { seed: mod.seedCalibrationHistory, bands: mod.PROSPECT_CALIBRATION };
}

// PROSPECT.1 — the generic prospect-seed runtime. Lives in src/scripts/ (NOT in
// @axona/db) so its node:fs / node:path imports are never pulled into the web
// bundle — only the seed script + verify-prospect-1 import it. Marque-free: knows
// nothing about any specific prospect; it upserts the org, clears ONLY that org's
// rows, applies branding + a demo login, then delegates the tailored data to the
// config's seed().

/**
 * Delete every tenant-owned row for ONE org, children before parents (FK-safe),
 * scoped to `orgId` — never a bare deleteMany, so other orgs (the investor demo)
 * are untouched. Mirrors the demo seed's clear order; the AuditLog append-only rule
 * is briefly disabled for this admin/maintenance path only.
 */
export async function clearOrgData(orgId: string): Promise<void> {
  const projects = await prisma.project.findMany({
    where: { orgId },
    select: { id: true },
  });
  const projectIds = projects.map((p) => p.id);

  // leaf / child rows first
  await prisma.memoryItem.deleteMany({ where: { orgId } });
  await prisma.entityLink.deleteMany({ where: { orgId } });
  await prisma.telemetryPoint.deleteMany({ where: { orgId } });
  await prisma.machineSignal.deleteMany({ where: { machine: { orgId } } });
  await prisma.workOrderField.deleteMany({ where: { orgId } });
  await prisma.inventoryStock.deleteMany({ where: { orgId } });
  await prisma.purchaseOrder.deleteMany({ where: { orgId } });
  // ATTACH.1 files carry File.orgId with NO projectId, so a project-scoped delete
  // missed them and every re-seed appended another copy — the warehouse tenant had 13
  // identical packing lists. Clear both shapes.
  await prisma.file.deleteMany({
    where: { OR: [{ project: { orgId } }, { orgId }] },
  });
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "AuditLog" DISABLE RULE audit_no_delete`,
  );
  await prisma.auditLog.deleteMany({ where: { orgId } });
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "AuditLog" ENABLE RULE audit_no_delete`,
  );
  await prisma.matrixColumn.deleteMany({
    where: { projectId: { in: projectIds } },
  });
  await prisma.message.deleteMany({ where: { chat: { orgId } } });
  await prisma.agentRun.deleteMany({ where: { agent: { orgId } } });
  await prisma.workflowRun.deleteMany({ where: { workflow: { orgId } } });

  // parents
  await prisma.robot.deleteMany({ where: { orgId } });
  await prisma.technician.deleteMany({ where: { orgId } });
  await prisma.supplier.deleteMany({ where: { orgId } });
  await prisma.part.deleteMany({ where: { orgId } });
  await prisma.agent.deleteMany({ where: { orgId } });
  await prisma.chat.deleteMany({ where: { orgId } });
  await prisma.workflow.deleteMany({ where: { orgId } });
  await prisma.project.deleteMany({ where: { orgId } });
  await prisma.machine.deleteMany({ where: { orgId } });

  // remaining flat tenant tables
  await prisma.workOrderMfg.deleteMany({ where: { orgId } });
  await prisma.nCR.deleteMany({ where: { orgId } });
  await prisma.spcSample.deleteMany({ where: { orgId } });
  await prisma.cert.deleteMany({ where: { orgId } });
  await prisma.deal.deleteMany({ where: { orgId } });
  await prisma.campaign.deleteMany({ where: { orgId } });
  await prisma.delivery.deleteMany({ where: { orgId } });
  await prisma.eCO.deleteMany({ where: { orgId } });
  await prisma.firmwareRelease.deleteMany({ where: { orgId } });
  await prisma.compatCell.deleteMany({ where: { orgId } });
  await prisma.autonomyMetric.deleteMany({ where: { orgId } });
  await prisma.safetyIncident.deleteMany({ where: { orgId } });
  await prisma.policyVersion.deleteMany({ where: { orgId } });
  await prisma.ledgerEntry.deleteMany({ where: { orgId } });
  await prisma.invoice.deleteMany({ where: { orgId } });
  await prisma.unitEconomic.deleteMany({ where: { orgId } });
  await prisma.requisition.deleteMany({ where: { orgId } });
  await prisma.cVE.deleteMany({ where: { orgId } });
  await prisma.obligation.deleteMany({ where: { orgId } });
  await prisma.exportLicense.deleteMany({ where: { orgId } });
  await prisma.legalMatter.deleteMany({ where: { orgId } });
  await prisma.notification.deleteMany({ where: { orgId } });
  await prisma.integration.deleteMany({ where: { orgId } });
  await prisma.apiKey.deleteMany({ where: { orgId } });
  await prisma.loginSession.deleteMany({ where: { orgId } });
  await prisma.user.deleteMany({ where: { orgId } });

  // SEED.4 — the SEARCH INDEX is a separate materialization of the rows above, and it
  // outlived every clear until now: `reindex()` UPSERTS, so a doc whose source row is
  // gone (or whose text was renamed) simply persisted. That is how a scrubbed
  // designation kept rendering on `/search` after a full re-seed. Clearing it here
  // makes the reset automatic — local AND prod — instead of a manual step nobody
  // remembers. seedProspectOrg rebuilds it for this org at the end of the seed.
  await prisma.searchDoc.deleteMany({ where: { orgId } });
}

const CONTENT_TYPE: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export interface SeedProspectResult {
  orgId: string;
  name: string;
  logoUploaded: boolean;
}

/**
 * Seed (idempotently) a prospect demo tenant from its config: upsert the org with
 * its branding, clear ONLY that org's rows, upload the logo (if any + S3 up), create
 * the org-scoped demo login, then run the config's own seed() for the tailored data.
 */
export async function seedProspectOrg(
  config: ProspectConfig,
  opts: { configDir: string },
): Promise<SeedProspectResult> {
  const { orgId } = config;
  if (!orgId) throw new Error("prospect config: orgId is required");

  // 1. org + branding (bare prisma; stable id → idempotent). onboardedAt set so the
  //    org skips the wizard; enabledModules [] ⇒ ALL modules on.
  await prisma.org.upsert({
    where: { id: orgId },
    update: {
      name: config.name,
      slug: config.slug,
      industry: config.industry ?? null,
      onboardedAt: new Date(),
      enabledModules: [],
    },
    create: {
      id: orgId,
      name: config.name,
      slug: config.slug,
      industry: config.industry ?? null,
      onboardedAt: new Date(),
      enabledModules: [],
    },
  });

  // 2. clear ONLY this org's tenant rows (isolation-safe)
  await clearOrgData(orgId);

  // 3. logo → the org's blob prefix (SET.1). PROSPECT.3: the logo path may be a LOCAL
  //    file OUTSIDE the repo (real logos are never committed — SEED.1) — an absolute
  //    path, a `~/…` home path, or a path relative to the (gitignored) config dir. Read
  //    at seed time and uploaded to the configured S3/R2 blob store (skipped without S3;
  //    point S3 at prod R2 to upload there). Bytes/paths never enter the repo.
  let logoUploaded = false;
  if (config.logoFile && s3Configured()) {
    const expanded = config.logoFile.startsWith("~/")
      ? resolve(homedir(), config.logoFile.slice(2))
      : config.logoFile;
    const path = isAbsolute(expanded)
      ? expanded
      : resolve(opts.configDir, expanded);
    const bytes = readFileSync(path);
    const ext = extname(path).toLowerCase();
    const key = `org/${orgId}/branding/logo${ext}`;
    await ensureBucket();
    await putObject(
      key,
      bytes,
      CONTENT_TYPE[ext] ?? "application/octet-stream",
    );
    await prisma.org.update({ where: { id: orgId }, data: { logoKey: key } });
    logoUploaded = true;
  }

  const db = dbForOrg(orgId);

  // 4. the org-scoped demo login (bcrypt; unique email cleared above → create fresh)
  const passwordHash = await bcrypt.hash(config.demoUser.password, 10);
  const demoUser = await db.user.create({
    data: {
      // org-scoped client re-injects orgId at runtime; set it here for the type.
      orgId,
      name: config.demoUser.name,
      email: config.demoUser.email,
      role: config.demoUser.role,
      passwordHash,
    },
    select: { id: true },
  });

  // 5. SEED.5 — the config seeds ITS OWN data. The runner used to force ONE shared
  //    cross-module narrative in here first, before every config's seed(). That
  //    narrative is drone/humanoid (actuator drives, torque SPC, Frame Build stations):
  //    on-narrative for a defense tenant, pollution on a warehouse-automation one,
  //    which ended up carrying a competitor's product category on every screen — and
  //    pushed its OWN hero PO to row 15 of 19, because /procurement orders by insertion.
  //
  //    So the runner is now domain-AGNOSTIC: it owns identity (org · branding · demo
  //    login), memory, calibration and the search index, and nothing about any
  //    industry. Each config owns its tenant's records — most call
  //    `seedDomainModules(db, orgId, PACK, …)` for the cross-module backdrop in their
  //    own vocabulary, AFTER writing their hero rows so those sort first.
  //    `seedTenantModules` stays exported for a config that opts into the old shared
  //    base deliberately.
  await config.seed({ db, orgId, configDir: opts.configDir });

  // 7. PROSPECT.3 — derive operational memory from the full substrate (base modules +
  //    the config's PLM thread), so the prospect's Axona agent can recall precedent.
  //    Best-effort: a memory-ingest failure must not fail the seed.
  try {
    await ingestMemory(db);
  } catch (err) {
    console.error(
      `[prospect-seed] ingestMemory skipped for ${orgId}:`,
      (err as Error).message,
    );
  }

  // 7b. DEMO.6 #4 — CONF.1: a decided-proposal history for THIS org, then fit its
  //     map. Seeded AFTER ingestMemory (as the base seed does) so the history stays
  //     calibration fodder rather than narrative memory. Without it the org has no
  //     fitted model and every agent confidence renders "uncalibrated" — which is
  //     honest, but means the RCA hero beat shows a number it openly distrusts.
  //     Org-scoped; each tenant's model is its own (isolation).
  try {
    const cal = await loadCalibrationSeed();
    await cal.seed(db, orgId, cal.bands, {
      prefix: `cal-${orgId.replace(/^org_/, "")}`,
      nowMs: Date.now(),
    });
    await calibrate(db, orgId);
  } catch (err) {
    console.error(
      `[prospect-seed] calibration skipped for ${orgId}:`,
      (err as Error).message,
    );
  }

  // 8. SEED.4 — rebuild THIS org's search index over the rows just written. Required,
  //    not optional: clearOrgData now deletes the org's SearchDoc rows, and the
  //    prospect path never reindexed — the tenants' docs were a side effect of the
  //    BASE seed's global `reindex()`. Without this the tenant would seed to an EMPTY
  //    `/search` (a worse failure than the stale index this replaces). Org-scoped, so
  //    no other tenant is touched. Best-effort, like ingestMemory: a search-index
  //    failure must not fail the seed.
  try {
    await reindex(orgId);
  } catch (err) {
    console.error(
      `[prospect-seed] reindex skipped for ${orgId}:`,
      (err as Error).message,
    );
  }

  return { orgId, name: config.name, logoUploaded };
}
