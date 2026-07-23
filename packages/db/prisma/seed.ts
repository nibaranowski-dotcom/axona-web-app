// FND.12 — seed the cross-module §3.7 narrative.
//   docker compose up -d  →  pnpm --filter @axona/db db:seed
//
// Idempotent: clear the demo org's tenant rows (scoped to DEMO_ORG_ID, FK-safe
// order), then reseed through dbForOrg so every row carries the demo orgId and
// ISO.1 is dogfooded. Org/Module/Users-bootstrap use the bare prisma client.
import { prisma, dbForOrg, reindex, ingestMemory, calibrate } from "../src";
import type { OrgScopedDb } from "../src";
import { DEMO_ORG_ID, SECOND_ORG_ID } from "./seed/constants";
import { seedModules } from "./seed/modules";
import { seedUsers } from "./seed/users";
import { seedAgents } from "./seed/agents";
import { seedValueChain } from "./seed/value-chain";
import { seedInventory } from "./seed/inventory";
import { seedRobotics } from "./seed/robotics";
import { seedBackOffice } from "./seed/back-office";
import { seedProjects } from "./seed/projects";
import { seedMatrix } from "./seed/matrix";
import { seedAudit } from "./seed/audit";
import { seedBilling } from "./seed/billing";
import { seedNotifications } from "./seed/notifications";
import { seedIntegrations } from "./seed/integrations";
import { seedMachines } from "./seed/machines";
import { seedWorkflows } from "./seed/workflows";
import { seedOntology } from "./seed/ontology";
import { seedPlm } from "./seed/plm";
import {
  seedCalibrationHistory,
  DEMO_CALIBRATION,
  ISOLATION_CALIBRATION,
} from "./seed/calibration";

/** Delete the demo org's tenant rows, children before parents, scoped to its
 *  orgId. NEVER a bare deleteMany — other tenants must be untouched. The Org row
 *  itself is kept (we don't rely on Org cascade). */
async function clearDemoOrg(): Promise<void> {
  const orgId = DEMO_ORG_ID;
  const demoProjects = await prisma.project.findMany({
    where: { orgId },
    select: { id: true },
  });
  const projectIds = demoProjects.map((p) => p.id);

  // children / leaf rows first
  await prisma.calibrationModel.deleteMany({ where: { orgId } }); // CONF.1 fitted model
  await prisma.memoryItem.deleteMany({ where: { orgId } }); // MEM.1 operational memory
  await prisma.entityLink.deleteMany({ where: { orgId } }); // ONT.1 link graph
  // PLM.1b — the deferred tier (children before parents; before the Unit deletes).
  // TestResult→TestRun and FieldEvent cascade off Unit, but ChangeRequest has no
  // Unit FK, so it must be cleared explicitly or its unique (orgId, code) collides.
  await prisma.testResult.deleteMany({ where: { orgId } });
  await prisma.testRun.deleteMany({ where: { orgId } });
  await prisma.fieldEvent.deleteMany({ where: { orgId } });
  await prisma.changeRequest.deleteMany({ where: { orgId } });
  // PLM.1a — the Unit spine cluster (children before parents; Unit FKs ProductModel)
  await prisma.asBuiltRecord.deleteMany({ where: { orgId } });
  await prisma.unitSoftwareState.deleteMany({ where: { orgId } });
  await prisma.bomLine.deleteMany({ where: { orgId } });
  await prisma.configurationVersion.deleteMany({ where: { orgId } });
  await prisma.unit.deleteMany({ where: { orgId } });
  await prisma.partRevision.deleteMany({ where: { orgId } });
  await prisma.softwareRelease.deleteMany({ where: { orgId } });
  await prisma.partMaster.deleteMany({ where: { orgId } });
  await prisma.productModel.deleteMany({ where: { orgId } });
  await prisma.telemetryPoint.deleteMany({ where: { orgId } });
  await prisma.machineSignal.deleteMany({ where: { machine: { orgId } } });
  await prisma.workOrderField.deleteMany({ where: { orgId } });
  await prisma.inventoryStock.deleteMany({ where: { orgId } });
  await prisma.purchaseOrder.deleteMany({ where: { orgId } });
  await prisma.file.deleteMany({ where: { project: { orgId } } });
  // AUDIT.1 — the append-only rule (audit_no_delete) makes a normal DELETE a no-op,
  // so the seed (an admin/maintenance path, not the app) briefly disables it to
  // clear THIS tenant's rows, then re-enables. The app path can never do this — it
  // has no DDL rights; immutability holds everywhere except this deliberate reseed.
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
  await prisma.user.deleteMany({ where: { orgId } });
}

/** Minimal rows for the second org so isolation is visible on screen. */
async function seedSecondOrg(db: OrgScopedDb): Promise<void> {
  const orgId = SECOND_ORG_ID;
  await db.supplier.deleteMany({ where: { orgId } }); // idempotent
  await db.supplier.create({
    data: { name: "Iso Test Supplier", tier: 2, riskScore: 0.2, onTimePct: 97 },
  });
}

async function main(): Promise<void> {
  // 1. Orgs (bare prisma; stable ids → idempotent re-seed). AUTH.4: give the
  // seeded orgs a workspace slug (new orgs derive theirs at signup).
  // AUTH.6: the demo org is already onboarded (skips the wizard) with all modules
  // enabled (empty enabledModules ⇒ ALL — kept explicit here for clarity).
  await prisma.org.upsert({
    where: { id: DEMO_ORG_ID },
    update: {
      name: "Axona",
      slug: "axona-demo-co",
      industry: "Humanoid",
      onboardedAt: new Date(),
      enabledModules: [],
    },
    create: {
      id: DEMO_ORG_ID,
      name: "Axona",
      slug: "axona-demo-co",
      industry: "Humanoid",
      onboardedAt: new Date(),
      enabledModules: [],
    },
  });
  await prisma.org.upsert({
    where: { id: SECOND_ORG_ID },
    update: { name: "Isolation Test Co", slug: "isolation-test-co" },
    create: {
      id: SECOND_ORG_ID,
      name: "Isolation Test Co",
      slug: "isolation-test-co",
    },
  });

  // 2. Idempotency — clear demo tenant rows
  await clearDemoOrg();

  // 3. Global modules
  await seedModules(prisma);

  // 4. Tenant data via the scoped client (orgId injected; ISO.1 dogfooded)
  const db = dbForOrg(DEMO_ORG_ID);
  const users = await seedUsers(db);
  const agents = await seedAgents(db);
  await seedValueChain(db);
  const inventory = await seedInventory(db);
  await seedRobotics(db);
  await seedBackOffice(db);
  // PLM.1a — the Unit spine + as-built + config thread. Runs BEFORE the ontology
  // graph because a UNIT node in that graph IS a Unit (PLM.2 reconciled the ONT.1
  // resolver onto the spine), so the Units must exist before the edges reference them.
  const plm = await seedPlm(db);
  // ONT.1 — the entity-link graph, after the record seeds so every edge resolves.
  const ontologyLinks = await seedOntology(db);
  const projects = await seedProjects(db);
  const matrix = await seedMatrix(db);
  const machines = await seedMachines(db);
  const workflows = await seedWorkflows(db);
  const nowMs = Date.now();
  const audit = await seedAudit(db, DEMO_ORG_ID, nowMs);
  await seedBilling(db, DEMO_ORG_ID); // BILL.3
  await seedNotifications(db, DEMO_ORG_ID); // NOTIF.1
  const demoAdmin = await prisma.user.findFirst({
    where: { orgId: DEMO_ORG_ID, role: "ADMIN" },
    select: { id: true },
  });
  await seedIntegrations(db, DEMO_ORG_ID, demoAdmin?.id ?? "seed"); // SET.5

  // MEM.1 — derive operational memory from the substrate just seeded (AuditLog,
  // NCRs, SPC breaches, safety incidents), AFTER seedOntology so the graph exists
  // for recall's proximity arm. FakeEmbedder offline (no EMBED_API_KEY) → CI-green.
  const memory = await ingestMemory(db);

  // CONF.1 — a decided-proposal history (seeded AFTER ingestMemory so it stays
  // calibration fodder, not narrative memory) that the engine fits from. The demo
  // org is systematically over-confident (agents ~0.9, humans approve ~60%), so its
  // fitted map corrects 0.9 → ~0.6. Idempotent; org-scoped.
  const calHistory = await seedCalibrationHistory(
    db,
    DEMO_ORG_ID,
    DEMO_CALIBRATION,
    {
      prefix: "cal-demo",
      nowMs,
    },
  );
  const calib = await calibrate(db, DEMO_ORG_ID);

  // 5. Second org (isolation contrast) — its OWN, disjoint calibration (under-confident).
  const secondDb = dbForOrg(SECOND_ORG_ID);
  await seedSecondOrg(secondDb);
  await seedCalibrationHistory(secondDb, SECOND_ORG_ID, ISOLATION_CALIBRATION, {
    prefix: "cal-iso",
    nowMs,
  });
  await calibrate(secondDb, SECOND_ORG_ID);

  // 6. Build the unified search index (SRCH.1) — globals + all tenants; idempotent.
  await reindex();

  const modules = await prisma.module.count();
  console.log(
    `Seed complete — modules: ${modules}, users: ${users}, agents: ${agents}, ` +
      `projects: ${projects}, machines: ${machines.total} (${machines.fixed} fixed), ` +
      `workflows: ${workflows.workflows} (${workflows.runs} runs), ` +
      `inventory: ${inventory.stock} stock rows, ` +
      `matrix: ${matrix.columns} cols (${matrix.cells} cells), ` +
      `audit: ${audit.entries} log entries, ` +
      `ontology: ${ontologyLinks} entity links, ` +
      `memory: ${memory.created} items (${memory.embedded} embedded), ` +
      `calibration: ${calHistory} decided proposals → n=${calib.sampleSize} (ECE ${calib.ece}).`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
