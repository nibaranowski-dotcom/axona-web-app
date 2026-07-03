import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";

// GET /api/workflows/:id/runs (WF.1) — org-scoped run list for a workflow (status
// + timing; feeds WFL.1). No SSE (that's WF.2).
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ runs: [] });
  const db = dbForOrg(user.orgId);
  const wf = await db.workflow.findFirst({ where: { id: params.id } });
  if (!wf) return new Response("not found", { status: 404 });

  const runs = await db.workflowRun.findMany({
    where: { workflowId: wf.id },
    orderBy: { startedAt: "desc" },
    take: 50,
    select: { id: true, status: true, startedAt: true, endedAt: true },
  });
  return Response.json({ runs });
}
