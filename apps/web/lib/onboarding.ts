import { prisma } from "@axona/db";

// AUTH.6 — onboarding + per-org module-enablement helpers (server-only reads +
// shared constants used by the wizard, the nav filter, and the routing checks).

// The 24 toggleable modules for the wizard's step 3, grouped as the nav is. `core`
// (the Command Center) is always-on and NOT toggleable — it's the home surface.
export type ModuleGroupKey =
  | "CORE"
  | "VALUE_CHAIN"
  | "ROBOTICS"
  | "BACK_OFFICE";

export interface WizardModule {
  key: string;
  name: string;
  defaultOn: boolean;
}
export interface WizardGroup {
  group: ModuleGroupKey;
  label: string;
  modules: WizardModule[];
}

// Sensible defaults mirror the design (a few off by default). `core` is implicit
// (always enabled) so it isn't listed as a toggle.
export const ONBOARDING_GROUPS: WizardGroup[] = [
  {
    group: "CORE",
    label: "Core",
    modules: [
      { key: "agents", name: "Agents", defaultOn: true },
      { key: "workflows", name: "Workflows", defaultOn: true },
      { key: "projects", name: "Projects", defaultOn: true },
      { key: "machines", name: "Machines", defaultOn: true },
    ],
  },
  {
    group: "VALUE_CHAIN",
    label: "Value chain",
    modules: [
      { key: "procurement", name: "Procurement", defaultOn: true },
      { key: "manufacturing", name: "Manufacturing", defaultOn: true },
      { key: "inventory", name: "Inventory", defaultOn: true },
      { key: "quality", name: "Quality", defaultOn: true },
      { key: "fulfillment", name: "Fulfillment", defaultOn: true },
      { key: "sales", name: "Sales & CRM", defaultOn: false },
      { key: "marketing", name: "Marketing", defaultOn: false },
    ],
  },
  {
    group: "ROBOTICS",
    label: "Robotics",
    modules: [
      { key: "fleet", name: "Fleet", defaultOn: true },
      { key: "field-service", name: "Field Service", defaultOn: true },
      { key: "engineering", name: "Engineering & PLM", defaultOn: true },
      { key: "autonomy", name: "Autonomy", defaultOn: false },
    ],
  },
  {
    group: "BACK_OFFICE",
    label: "Back office",
    modules: [
      { key: "finance", name: "Finance", defaultOn: true },
      { key: "people", name: "People", defaultOn: false },
      { key: "security", name: "Security", defaultOn: false },
      { key: "legal", name: "Legal", defaultOn: false },
    ],
  },
];

// `core` is always enabled (the Command Center is the home surface).
export const ALWAYS_ON = ["core"] as const;

export const ONBOARDING_MODULE_KEYS = ONBOARDING_GROUPS.flatMap((g) =>
  g.modules.map((m) => m.key),
);

export const DEFAULT_ENABLED = [
  ...ALWAYS_ON,
  ...ONBOARDING_GROUPS.flatMap((g) =>
    g.modules.filter((m) => m.defaultOn).map((m) => m.key),
  ),
];

export interface OrgOnboarding {
  onboardedAt: Date | null;
  enabledModules: string[];
}

export async function getOrgOnboarding(
  orgId: string,
): Promise<OrgOnboarding | null> {
  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: {
      onboardedAt: true,
      enabledModules: true,
      name: true,
      industry: true,
    },
  });
  if (!org) return null;
  return { onboardedAt: org.onboardedAt, enabledModules: org.enabledModules };
}

// Null/empty enabledModules ⇒ ALL enabled (back-compat for demo / pre-existing).
// `core` is always enabled.
export function isModuleEnabled(
  enabledModules: string[] | null | undefined,
  key: string,
): boolean {
  if (ALWAYS_ON.includes(key as (typeof ALWAYS_ON)[number])) return true;
  if (!enabledModules || enabledModules.length === 0) return true;
  return enabledModules.includes(key);
}
