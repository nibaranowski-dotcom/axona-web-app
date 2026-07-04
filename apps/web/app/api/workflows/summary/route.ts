import { getCurrentUser } from "@/lib/session";
import { getWorkflowsData } from "@/lib/workflows";

// GET /api/workflows/summary — the module-separated groups + rollup (total,
// active, runs·30d, agents orchestrated). Read-only.
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ groups: [], rollup: null });
  const { groups, rollup } = await getWorkflowsData(user.orgId);
  return Response.json({ groups, rollup });
}
