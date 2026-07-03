import { getCurrentUser } from "@/lib/session";
import { getMarketingData } from "@/lib/marketing";

// GET /api/marketing/funnel — the derived demand funnel + pipeline-by-channel
// attribution + rollup (reconciled to SALES.1). Read-only.
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ rollup: null, campaigns: [] });
  const { campaigns, rollup } = await getMarketingData(user.orgId);
  return Response.json({ rollup, campaigns });
}
