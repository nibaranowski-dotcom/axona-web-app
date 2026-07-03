import { getCurrentUser } from "@/lib/session";
import { getProjectsData } from "@/lib/projects";

// GET /api/projects/summary — the module-separated groups + rollup (counts by
// status, files total, needs-attention). Read-only.
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ groups: [], rollup: null });
  const { groups, rollup } = await getProjectsData(user.orgId);
  return Response.json({ groups, rollup });
}
