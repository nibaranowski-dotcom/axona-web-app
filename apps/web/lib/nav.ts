import { prisma } from "@axona/db";

// Nav data for the shell. Modules are a GLOBAL catalog (no orgId) — read with
// the bare client. Slugs come from Module.key; Mission Control is special-cased
// to "/" (it's the post-login landing).

const GROUP_ORDER = ["CORE", "VALUE_CHAIN", "ROBOTICS", "BACK_OFFICE"] as const;
const GROUP_LABEL: Record<string, string> = {
  CORE: "Core",
  VALUE_CHAIN: "Value chain",
  ROBOTICS: "Robotics",
  BACK_OFFICE: "Back office",
};

export interface NavModule {
  key: string;
  name: string;
  href: string;
}
export interface NavGroup {
  group: string;
  label: string;
  modules: NavModule[];
}

function hrefFor(key: string): string {
  return key === "mission-control" ? "/" : `/${key}`;
}

export async function getNavModules(): Promise<NavGroup[]> {
  const rows = await prisma.module.findMany({
    orderBy: [{ group: "asc" }, { orderIndex: "asc" }],
  });
  return GROUP_ORDER.map((g) => ({
    group: g,
    label: GROUP_LABEL[g] ?? g,
    modules: rows
      .filter((m) => m.group === g)
      .map((m) => ({ key: m.key, name: m.name, href: hrefFor(m.key) })),
  })).filter((grp) => grp.modules.length > 0);
}
