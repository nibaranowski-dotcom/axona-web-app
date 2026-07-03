import { getCurrentUser } from "@/lib/session";
import { getSalesData } from "@/lib/sales";

// GET /api/sales/forecast — the derived pipeline funnel + weighted forecast +
// deliverability spread (over FUL.1 + MFG.1). Read-only.
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ rollup: null, deals: [] });
  const { deals, rollup } = await getSalesData(user.orgId);
  return Response.json({ rollup, deals });
}
