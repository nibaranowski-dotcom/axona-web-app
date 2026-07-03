import { getCurrentUser } from "@/lib/session";
import { getMachinesData } from "@/lib/machines";

// GET /api/machines/summary — the Fixed/Mobile groups + rollup (needs-service,
// avg utilization, telemetry-online). Read-only.
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ groups: [], rollup: null });
  const { groups, rollup } = await getMachinesData(user.orgId);
  return Response.json({ groups, rollup });
}
