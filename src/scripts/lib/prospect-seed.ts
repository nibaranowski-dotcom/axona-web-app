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
  type ProspectConfig,
  type OrgScopedDb,
} from "@axona/db";

// PROSPECT.3 — the SAME cross-module generators the base/investor seed uses, run for
// the prospect org so every non-PLM module screen renders as populated. The prisma
// seed files (packages/db/prisma/seed/*) are tsx-run and intentionally NOT in any tsc
// project (they omit orgId, relying on the org-scoped client's runtime injection), so
// we load the wrapper via a computed specifier — tsc doesn't pull its un-typechecked
// deps into src/scripts's program; the local type keeps the call site safe.
type SeedTenantModules = (
  db: OrgScopedDb,
  orgId: string,
  opts: { nowMs: number; adminUserId: string },
) => Promise<unknown>;
const TENANT_SEED_MODULE = "../../../packages/db/prisma/seed/tenant";
async function loadSeedTenantModules(): Promise<SeedTenantModules> {
  const mod = (await import(TENANT_SEED_MODULE)) as {
    seedTenantModules: SeedTenantModules;
  };
  return mod.seedTenantModules;
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
  await prisma.file.deleteMany({ where: { project: { orgId } } });
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

  // 5. PROSPECT.3 — the full cross-module narrative (procurement · quality · mfg · sales
  //    · fleet · field service · finance · people · autonomy · legal · security ·
  //    inventory · marketing · machines · projects · workflows · billing · notifications
  //    · integrations · audit), reusing the base generators, org-scoped → isolated. This
  //    is the FOUNDATION the config's identity + PLM + agents overlay sits on top of.
  const seedTenantModules = await loadSeedTenantModules();
  await seedTenantModules(db, orgId, {
    nowMs: Date.now(),
    adminUserId: demoUser.id,
  });

  // 6. tailored overlay (identity + PLM golden thread + agents), over existing models,
  //    org-scoped by construction. Runs AFTER the base narrative so it layers on top.
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

  return { orgId, name: config.name, logoUploaded };
}
