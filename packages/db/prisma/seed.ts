// FND.12 — seed the cross-module §3.7 narrative.
//   docker compose up -d  →  pnpm --filter @axona/db db:seed
//
// Idempotent: clear the demo org's tenant rows (scoped to DEMO_ORG_ID, FK-safe
// order), then reseed through dbForOrg so every row carries the demo orgId and
// ISO.1 is dogfooded. Org/Module/Users-bootstrap use the bare prisma client.
import { prisma, dbForOrg, reindex } from "../src";
import type { OrgScopedDb } from "../src";
import { DEMO_ORG_ID, SECOND_ORG_ID } from "./seed/constants";
import { seedModules } from "./seed/modules";
import { seedUsers } from "./seed/users";
import { seedAgents } from "./seed/agents";
import { seedValueChain } from "./seed/value-chain";
import { seedRobotics } from "./seed/robotics";
import { seedBackOffice } from "./seed/back-office";
import { seedProjects } from "./seed/projects";
import { seedMachines } from "./seed/machines";

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
  await prisma.telemetryPoint.deleteMany({ where: { orgId } });
  await prisma.machineSignal.deleteMany({ where: { machine: { orgId } } });
  await prisma.workOrderField.deleteMany({ where: { orgId } });
  await prisma.purchaseOrder.deleteMany({ where: { orgId } });
  await prisma.file.deleteMany({ where: { project: { orgId } } });
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
  // 1. Orgs (bare prisma; stable ids → idempotent re-seed)
  await prisma.org.upsert({
    where: { id: DEMO_ORG_ID },
    update: { name: "Axona Demo Co" },
    create: { id: DEMO_ORG_ID, name: "Axona Demo Co" },
  });
  await prisma.org.upsert({
    where: { id: SECOND_ORG_ID },
    update: { name: "Isolation Test Co" },
    create: { id: SECOND_ORG_ID, name: "Isolation Test Co" },
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
  await seedRobotics(db);
  await seedBackOffice(db);
  const projects = await seedProjects(db);
  const machines = await seedMachines(db);

  // 5. Second org (isolation contrast)
  await seedSecondOrg(dbForOrg(SECOND_ORG_ID));

  // 6. Build the unified search index (SRCH.1) — globals + all tenants; idempotent.
  await reindex();

  const modules = await prisma.module.count();
  console.log(
    `Seed complete — modules: ${modules}, users: ${users}, agents: ${agents}, ` +
      `projects: ${projects}, machines: ${machines.total} (${machines.fixed} fixed).`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
