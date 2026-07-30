import type { OrgScopedDb } from "../../src";
import { seedValueChain } from "./value-chain";
import { seedInventory } from "./inventory";
import { seedRobotics } from "./robotics";
import { seedBackOffice } from "./back-office";
import { seedProjects } from "./projects";
import { seedMatrix } from "./matrix";
import { seedMachines } from "./machines";
import { seedWorkflows } from "./workflows";
import { seedAudit } from "./audit";
import { seedBilling } from "./billing";
import { seedNotifications } from "./notifications";
import { seedIntegrations } from "./integrations";

// PROSPECT.3 — the reusable, cross-module tenant narrative. Runs the SAME per-module
// generators the base/investor seed uses (no parallel dataset), against ANY org via
// its org-scoped `db` — so a prospect tenant gets the full richness across every
// non-PLM domain module (procurement · quality/SPC · manufacturing · sales · fleet ·
// field service · finance · people · autonomy · legal · security · inventory ·
// marketing · machines · projects · matrix · workflows · billing · notifications ·
// integrations · audit). Isolation holds by construction: every write goes through
// the org-scoped `db`.
//
// DELIBERATELY EXCLUDED (owned elsewhere, to avoid double-seeding / collisions):
//   • users   — identity is per-tenant (User.email is globally unique; the prospect
//     runner seeds its own demo login, the base seed its own team).
//   • agents  — a prospect config overlays its OWN roster; the base seed its own.
//   • PLM + ontology — the prospect config owns its tailored golden-thread (it clears
//     the PLM tables and rebuilds them + the entity-link graph). The base seed runs
//     seedPlm/seedOntology itself. Running them here would be overwritten/duplicated.
//   • memory/calibration/trust — derived AFTER the substrate exists (the caller runs
//     ingestMemory once the config overlay has loaded the PLM thread too).

export interface SeedTenantModulesResult {
  inventory: { stock: number; parts: number };
  projects: number;
  matrix: { columns: number; cells: number };
  machines: { total: number; fixed: number };
  workflows: { workflows: number; runs: number };
  audit: { entries: number };
}

/**
 * Seed the full cross-module tenant narrative for `orgId` via its org-scoped `db`.
 * `adminUserId` is any existing user in the org (integrations records a creator).
 * `nowMs` anchors the audit-log timestamps.
 */
export async function seedTenantModules(
  db: OrgScopedDb,
  orgId: string,
  opts: { nowMs: number; adminUserId: string },
): Promise<SeedTenantModulesResult> {
  // record seeds (value chain → inventory → robotics → back office)
  await seedValueChain(db); // suppliers · parts · POs · WOs · NCRs · SPC · certs · deals · campaigns · deliveries
  const inventory = await seedInventory(db); // inventory stock + part masters
  await seedRobotics(db); // fleet robots · telemetry · field WOs · techs · ECOs · firmware · compat · autonomy · safety · policy
  await seedBackOffice(db); // ledger · invoices · unit-economics · requisitions · CVEs · obligations · export licenses · legal matters

  // workspace + ops surfaces
  const projects = await seedProjects(db);
  const matrix = await seedMatrix(db);
  const machines = await seedMachines(db);
  const workflows = await seedWorkflows(db);

  // cross-cutting: audit trail · SaaS billing · notifications · integrations
  const audit = await seedAudit(db, orgId, opts.nowMs);
  await seedBilling(db, orgId);
  await seedNotifications(db, orgId);
  await seedIntegrations(db, orgId, opts.adminUserId);

  return { inventory, projects, matrix, machines, workflows, audit };
}
