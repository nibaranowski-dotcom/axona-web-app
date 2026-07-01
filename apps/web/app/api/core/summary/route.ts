import { getCoreSummary } from "@/lib/core-summary";
import { getCurrentUser } from "@/lib/session";

// GET /api/core/summary (build-spec §6) — the org-scoped Command Center rollup:
// per-module KPIs + the cross-module exception feed. CMD.2 renders it; the GA.1
// copilot answers over the same data. Org via getCurrentUser (FND.13 stub).
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ company: [], kpisByModule: [], exceptions: [] });
  }
  return Response.json(await getCoreSummary(user.orgId));
}
