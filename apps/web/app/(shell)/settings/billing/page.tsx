import { getCurrentUser } from "@/lib/session";
import { getBilling } from "@/lib/billing";
import { BillingView } from "@/components/settings/BillingView";

// /settings/billing (BILL.3) — SaaS billing (plan · seats · usage · invoices).
export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const data = await getBilling(user.orgId);
  if (!data) return null;
  return <BillingView data={data} isAdmin={user.role === "ADMIN"} />;
}
