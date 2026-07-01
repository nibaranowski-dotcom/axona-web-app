import { Launcher } from "@/components/core/Launcher";
import { getModuleAlerts } from "@/lib/module-alerts";
import { getNavModules } from "@/lib/nav";
import { getCurrentUser } from "@/lib/session";

// Mission Control (build-spec §4.1) — the post-login DARK launchpad at "/".
// Full-screen (no shell), matching the DS prototype (Mission Control.dc.html).
// Module screens live under the (shell) group with the sidebar/agent-pane.
export const dynamic = "force-dynamic";

export default async function MissionControl() {
  const user = await getCurrentUser(); // TODO AUTH.1
  const [groups, alerts] = await Promise.all([
    getNavModules(),
    user ? getModuleAlerts(user.orgId) : Promise.resolve({}),
  ]);
  return <Launcher groups={groups} alerts={alerts} />;
}
