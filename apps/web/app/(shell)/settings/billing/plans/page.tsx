import { getCurrentUser } from "@/lib/session";
import { getBilling, getPlans } from "@/lib/billing";
import { PlansView } from "@/components/settings/PlansView";

// /settings/billing/plans (BILL.3) — the 3-tier pricing comparison + upgrade.
export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const billing = await getBilling(user.orgId);
  return (
    <PlansView
      plans={getPlans()}
      currentTier={billing?.plan ?? "PILOT"}
      isAdmin={user.role === "ADMIN"}
    />
  );
}
