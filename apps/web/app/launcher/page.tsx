import { Launcher } from "@/components/core/Launcher";
import { getModuleAlerts } from "@/lib/module-alerts";
import { getNavModules } from "@/lib/nav";
import { getCurrentUser } from "@/lib/session";

// Mission Control (build-spec §4.1) — the DARK launchpad, re-homed to /launcher
// (UX.3). Full-screen (outside the (shell) group, no sidebar/agent-pane), matching
// Mission Control.dc.html. The app now LANDS on /core (Command Center); the
// launcher stays reachable from the sidebar wordmark + the search bar.
export const dynamic = "force-dynamic";

export default async function MissionControl() {
  const user = await getCurrentUser(); // TODO AUTH.1
  const [groups, alerts] = await Promise.all([
    getNavModules(),
    user ? getModuleAlerts(user.orgId) : Promise.resolve({}),
  ]);
  return <Launcher groups={groups} alerts={alerts} />;
}
