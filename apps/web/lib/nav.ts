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

// PLM.2–5 — top-level routes that a MODULE owns in the nav. A unit is a
// first-class object (its own route), but Engineering is the PLM hub, so the
// unit registry / unit page / as-built diff / blast radius all keep Engineering
// lit in the sidebar — which is what every PLM `.dc.html` shows.
const MODULE_OWNED_ROUTES: Record<string, string[]> = {
  "/engineering": ["/units", "/blast-radius"],
};

/** Is this nav item the active one for `pathname`? (exact, or an owned subtree) */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return (MODULE_OWNED_ROUTES[href] ?? []).some(
    (r) => pathname === r || pathname.startsWith(`${r}/`),
  );
}

// AUTH.6: `enabledModules` filters the nav to the org's enabled set. Null/empty ⇒
// ALL (back-compat for the demo + pre-existing orgs). `core` + the palette entries
// (mission-control/search, hidden from the left nav anyway) are always kept.
export async function getNavModules(
  enabledModules?: string[] | null,
): Promise<NavGroup[]> {
  const rows = await prisma.module.findMany({
    orderBy: [{ group: "asc" }, { orderIndex: "asc" }],
  });
  const all = !enabledModules || enabledModules.length === 0;
  const keep = (key: string) =>
    all ||
    key === "core" ||
    key === "mission-control" ||
    key === "search" ||
    enabledModules!.includes(key);
  return GROUP_ORDER.map((g) => ({
    group: g,
    label: GROUP_LABEL[g] ?? g,
    modules: rows
      .filter((m) => m.group === g && keep(m.key))
      .map((m) => ({ key: m.key, name: m.name, href: hrefFor(m.key) })),
  })).filter((grp) => grp.modules.length > 0);
}
