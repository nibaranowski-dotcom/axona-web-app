import type { PrismaClient } from "../../src";

// The product's nav modules (build-spec §1). 22 modules across 4 groups —
// Command Center..Machines (Core), Procurement..Marketing (Value chain),
// Fleet..Autonomy (Robotics), Finance..Legal (Back office). `key` = route slug.
// NOTE: the PRD header says "24" (it counts the Workflow-detail + Project-files
// SCREENS); the build-spec §1 module list — the source of truth — is 22 nav
// modules. We seed the 22 real modules; verify-fnd-12 asserts 22.

type Mod = {
  key: string;
  name: string;
  group: ModuleGroupStr;
  orderIndex: number;
};
type ModuleGroupStr = "CORE" | "VALUE_CHAIN" | "ROBOTICS" | "BACK_OFFICE";

export const MODULES: Mod[] = [
  // CORE
  { key: "core", name: "Command Center", group: "CORE", orderIndex: 0 },
  {
    key: "mission-control",
    name: "Mission Control",
    group: "CORE",
    orderIndex: 1,
  },
  { key: "search", name: "Search", group: "CORE", orderIndex: 2 },
  { key: "agents", name: "Agents", group: "CORE", orderIndex: 3 },
  { key: "workflows", name: "Workflows", group: "CORE", orderIndex: 4 },
  { key: "projects", name: "Projects", group: "CORE", orderIndex: 5 },
  { key: "machines", name: "Machines", group: "CORE", orderIndex: 6 },
  // VALUE CHAIN
  {
    key: "procurement",
    name: "Procurement",
    group: "VALUE_CHAIN",
    orderIndex: 7,
  },
  {
    key: "manufacturing",
    name: "Manufacturing",
    group: "VALUE_CHAIN",
    orderIndex: 8,
  },
  { key: "inventory", name: "Inventory", group: "VALUE_CHAIN", orderIndex: 9 },
  {
    key: "fulfillment",
    name: "Fulfillment",
    group: "VALUE_CHAIN",
    orderIndex: 10,
  },
  { key: "quality", name: "Quality", group: "VALUE_CHAIN", orderIndex: 11 },
  { key: "sales", name: "Sales & CRM", group: "VALUE_CHAIN", orderIndex: 12 },
  { key: "marketing", name: "Marketing", group: "VALUE_CHAIN", orderIndex: 13 },
  // ROBOTICS
  { key: "fleet", name: "Fleet", group: "ROBOTICS", orderIndex: 14 },
  {
    key: "field-service",
    name: "Field Service",
    group: "ROBOTICS",
    orderIndex: 15,
  },
  {
    key: "engineering",
    name: "Engineering & PLM",
    group: "ROBOTICS",
    orderIndex: 16,
  },
  { key: "autonomy", name: "Autonomy", group: "ROBOTICS", orderIndex: 17 },
  // BACK OFFICE
  { key: "finance", name: "Finance", group: "BACK_OFFICE", orderIndex: 18 },
  { key: "people", name: "People", group: "BACK_OFFICE", orderIndex: 19 },
  { key: "security", name: "Security", group: "BACK_OFFICE", orderIndex: 20 },
  { key: "legal", name: "Legal", group: "BACK_OFFICE", orderIndex: 21 },
];

/** Modules are global (no orgId) — seed via the bare prisma client, idempotent by `key`. */
export async function seedModules(prisma: PrismaClient): Promise<void> {
  for (const m of MODULES) {
    await prisma.module.upsert({
      where: { key: m.key },
      update: { name: m.name, group: m.group, orderIndex: m.orderIndex },
      create: {
        id: m.key,
        key: m.key,
        name: m.name,
        group: m.group,
        orderIndex: m.orderIndex,
      },
    });
  }
}
