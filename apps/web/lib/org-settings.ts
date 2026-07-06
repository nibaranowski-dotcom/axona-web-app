import { prisma, type Role } from "@axona/db";
import {
  ONBOARDING_GROUPS,
  ONBOARDING_MODULE_KEYS,
  ALWAYS_ON,
  isModuleEnabled,
} from "./onboarding";

// SET.1 — org-settings read model + shared constants (server-only). getOrgSettings
// returns the org profile + defaults + the full module grid (reusing AUTH.6's
// ONBOARDING_GROUPS so SET.1's module management is identical to onboarding's) with
// on/off resolved from Org.enabledModules.

export const TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/Detroit",
  "America/New_York",
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
] as const;

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export interface OrgModuleRow {
  key: string;
  name: string;
  group: string; // display label (Core / Value chain / …)
  enabled: boolean;
}

export interface OrgSettings {
  name: string;
  slug: string; // read-only display
  industry: string | null;
  logoKey: string | null;
  timezone: string | null;
  fiscalYearStartMonth: number | null;
  defaultMemberRole: Role | null;
  enabledModules: string[];
  moduleGroups: { label: string; modules: OrgModuleRow[] }[];
  enabledCount: number;
  totalModules: number;
}

export async function getOrgSettings(
  orgId: string,
): Promise<OrgSettings | null> {
  const org = await prisma.org.findUnique({ where: { id: orgId } });
  if (!org) return null;

  const moduleGroups = ONBOARDING_GROUPS.map((g) => ({
    label: g.label,
    modules: g.modules.map((m) => ({
      key: m.key,
      name: m.name,
      group: g.label,
      enabled: isModuleEnabled(org.enabledModules, m.key),
    })),
  }));
  const enabledCount = ONBOARDING_MODULE_KEYS.filter((k) =>
    isModuleEnabled(org.enabledModules, k),
  ).length;

  return {
    name: org.name,
    slug: org.slug ?? "",
    industry: org.industry,
    logoKey: org.logoKey,
    timezone: org.timezone,
    fiscalYearStartMonth: org.fiscalYearStartMonth,
    defaultMemberRole: org.defaultMemberRole,
    enabledModules: org.enabledModules,
    moduleGroups,
    enabledCount,
    totalModules: ONBOARDING_MODULE_KEYS.length,
  };
}

// SET.1 — normalize a requested enabled-module set: keep only known toggleable keys,
// and ALWAYS include the always-on core (the "keep the app usable" guard — an ADMIN
// can never disable the Command Center / lock themselves out of nav).
export function normalizeEnabledModules(keys: string[]): string[] {
  const chosen = keys.filter((k) => ONBOARDING_MODULE_KEYS.includes(k));
  return Array.from(new Set([...ALWAYS_ON, ...chosen]));
}
