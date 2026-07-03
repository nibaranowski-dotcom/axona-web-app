import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";

// GET /api/workflow-runs/:runId (WF.1) — org-scoped read of one run's status +
// full trace (feeds WFL.2's replay). Org isolation: a miss is a 404, never a leak.
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { runId: string } },
) {
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  const run = await dbForOrg(user.orgId).workflowRun.findFirst({
    where: { id: params.runId },
    select: {
      id: true,
      workflowId: true,
      status: true,
      trace: true,
      startedAt: true,
      endedAt: true,
    },
  });
  if (!run) return new Response("not found", { status: 404 });
  return Response.json({ run });
}
