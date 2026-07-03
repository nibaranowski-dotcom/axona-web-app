import { dbForOrg, type Role } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { requireRole } from "@/lib/rbac";
import { enqueueWorkflowRun } from "@/lib/workflow-queue";

// POST /api/workflows/:id/run (WF.1, spec §5) — RBAC-check the caller, load the
// workflow org-scoped, enqueue a run, return the runId. VIEWER cannot run. The
// engine parks money/safety/contract at the guardrail gate (AWAITING_APPROVAL);
// it never auto-executes. orgId comes from the session, never the client.
export const dynamic = "force-dynamic";

// Who can run a workflow: everyone but VIEWER (per-module policy hardens in RBAC.3).
const CAN_RUN: Role[] = [
  "ADMIN",
  "OPS",
  "ENGINEER",
  "SALES",
  "FINANCE",
  "TECH",
];

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  try {
    requireRole(user, CAN_RUN);
  } catch {
    return new Response("forbidden", { status: 403 });
  }

  const db = dbForOrg(user.orgId);
  const wf = await db.workflow.findFirst({ where: { id: params.id } });
  if (!wf) return new Response("not found", { status: 404 });

  let triggerPayload: Record<string, unknown> = {};
  try {
    const body = await req.json();
    if (body && typeof body === "object" && body.triggerPayload)
      triggerPayload = body.triggerPayload as Record<string, unknown>;
  } catch {
    // no body → empty payload
  }

  const runId = await enqueueWorkflowRun({
    workflowId: wf.id,
    orgId: user.orgId,
    userId: user.id,
    triggerPayload,
  });
  return Response.json({ runId });
}
