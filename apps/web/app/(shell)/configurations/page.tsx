import { getCurrentUser } from "@/lib/session";
import { hasRole } from "@/lib/rbac";
import { getConfigurations } from "@/lib/configurations";
import { ConfigurationsView } from "@/components/configurations/ConfigurationsView";

// /configurations (PLM.10 · `Configurations.dc.html`) — named ConfigurationVersions
// with resolved hw+sw, baseline/lock state, and matching-units counts. Answers Q2
// at fleet level. Lock/baseline is gated via decide("config.lock"). LIST screen →
// back-arrow + eyebrow. Org-scoped via getConfigurations → dbForOrg.
export const dynamic = "force-dynamic";

export default async function ConfigurationsPage() {
  const user = await getCurrentUser();
  if (!user) return <ConfigurationsView configs={[]} canLock={false} />;

  try {
    const configs = await getConfigurations(user.orgId);
    return (
      <ConfigurationsView
        configs={configs}
        canLock={hasRole(user, ["ENGINEER", "ADMIN"])}
      />
    );
  } catch {
    return <ConfigurationsView configs={[]} canLock={false} />;
  }
}
