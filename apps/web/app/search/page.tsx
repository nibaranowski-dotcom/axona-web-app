import { Launcher } from "@/components/core/Launcher";
import { getModuleAlerts } from "@/lib/module-alerts";
import { getNavModules } from "@/lib/nav";
import { getCurrentUser } from "@/lib/session";

// /search?q= — deep-link route. Renders the launchpad and opens the global ⌘K
// palette pre-filled with q (SRCH.3). Static route → takes precedence over the
// (shell)/[module] catch-all for the "search" segment.
export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const user = await getCurrentUser();
  const [groups, alerts] = await Promise.all([
    getNavModules(),
    user ? getModuleAlerts(user.orgId) : Promise.resolve({}),
  ]);
  return (
    <Launcher
      groups={groups}
      alerts={alerts}
      deepLinkQuery={searchParams.q ?? ""}
    />
  );
}
