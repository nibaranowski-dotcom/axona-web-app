import { Launcher } from "@/components/core/Launcher";
import { getModuleAlerts } from "@/lib/module-alerts";
import { getNavModules } from "@/lib/nav";
import { getCurrentUser } from "@/lib/session";

// Mission Control (build-spec §4.1) — the post-login launcher, in the shell <main>.
export default async function MissionControl() {
  const user = await getCurrentUser(); // TODO AUTH.1
  const [groups, alerts] = await Promise.all([
    getNavModules(),
    user ? getModuleAlerts(user.orgId) : Promise.resolve({}),
  ]);
  return <Launcher groups={groups} alerts={alerts} />;
}
