import { getCurrentUser } from "@/lib/session";
import { getCoreSummary, type CoreSummary } from "@/lib/core-summary";
import { CommandCenter } from "@/components/core/CommandCenter";

// /core — the Command Center (build-spec §4.3). Server-fetches the CMD.1 rollup
// (org-scoped via getCoreSummary → dbForOrg) and renders the KPI grid +
// cross-module exception feed + the GA.1 copilot entry. Static route → takes
// precedence over the (shell)/[module] catch-all for "core" (like /agents).
export const dynamic = "force-dynamic";

const EMPTY: CoreSummary = { company: [], kpisByModule: [], exceptions: [] };

export default async function CommandCenterPage() {
  const user = await getCurrentUser();
  if (!user) return <CommandCenter summary={EMPTY} />;

  try {
    const summary = await getCoreSummary(user.orgId);
    return <CommandCenter summary={summary} />;
  } catch {
    return <CommandCenter summary={EMPTY} error />;
  }
}
