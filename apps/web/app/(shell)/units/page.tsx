import { getCurrentUser } from "@/lib/session";
import { hasRole } from "@/lib/rbac";
import { getUnitRegistry, UNIT_PAGE_SIZE, type UnitFilters } from "@/lib/units";
import { UnitRegistryView } from "@/components/units/UnitRegistryView";

// /units (PLM.2 · `Unit Registry.dc.html`) — the Unit registry. Answers "which
// units run sw v4.2.1, at Site-2, from lot 88421?"; every filter is read from and
// written to the URL, so a filtered registry is a shareable link. Org-scoped via
// getUnitRegistry → dbForOrg. Static shell route → precedence over (shell)/[module].
export const dynamic = "force-dynamic";

const EMPTY = {
  rows: [],
  matched: 0,
  total: 0,
  page: 1,
  pageSize: UNIT_PAGE_SIZE,
  facets: { model: [], config: [], sw: [], lot: [], site: [], status: [] },
};

export default async function UnitsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await getCurrentUser();
  if (!user) return <UnitRegistryView data={EMPTY} canImport={false} />;

  const one = (k: string): string | undefined => {
    const v = searchParams?.[k];
    const s = Array.isArray(v) ? v[0] : v;
    return s && s.length > 0 ? s : undefined;
  };
  const filters: UnitFilters = {
    q: one("q"),
    model: one("model"),
    config: one("config"),
    sw: one("sw"),
    lot: one("lot"),
    site: one("site"),
    status: one("status"),
  };
  const page = Number.parseInt(one("page") ?? "1", 10) || 1;

  try {
    const data = await getUnitRegistry(user.orgId, filters, page);
    return (
      <UnitRegistryView
        data={data}
        canImport={hasRole(user, ["ENGINEER", "ADMIN"])}
      />
    );
  } catch {
    return <UnitRegistryView data={EMPTY} canImport={false} error />;
  }
}
