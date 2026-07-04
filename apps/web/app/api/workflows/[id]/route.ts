import { getCurrentUser } from "@/lib/session";
import { getWorkflowDetail } from "@/lib/workflows";

// GET /api/workflows/:id (WFL.2) — org-scoped workflow detail: the parsed step-
// flow + its runs (with persisted traces). Read-only; running is [id]/run (WF.1).
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  const detail = await getWorkflowDetail(user.orgId, params.id);
  if (!detail) return new Response("not found", { status: 404 });
  return Response.json({ detail });
}
