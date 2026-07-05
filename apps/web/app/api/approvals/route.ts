import { decide, type ApprovalKind, type Decision } from "@/lib/approvals";
import { getCurrentUser } from "@/lib/session";

// POST /api/approvals { kind, targetId, decision } — RBAC.4 decision endpoint for
// client surfaces (the workflow detail's parked-run Approve/Reject). decide()
// role-gates (line 1), loads org-scoped, transitions, and writes the AUDIT.1 entry.
// A forbidden role → 403; an unknown/decided target → structured 404/409.
export const dynamic = "force-dynamic";

const KINDS: ApprovalKind[] = [
  "po.approve",
  "eco.release",
  "policy.rollback",
  "creditnote.issue",
  "workflow.gate",
];

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  let body: { kind?: string; targetId?: string; decision?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("expected JSON body", { status: 400 });
  }
  const kind = body.kind as ApprovalKind;
  const decision = body.decision as Decision;
  if (
    !KINDS.includes(kind) ||
    (decision !== "APPROVE" && decision !== "REJECT")
  ) {
    return new Response("invalid kind or decision", { status: 400 });
  }
  if (!body.targetId)
    return new Response("targetId is required", { status: 400 });

  try {
    const result = await decide(kind, body.targetId, decision, user);
    if (!result.ok) {
      return Response.json(result, {
        status: result.reason === "not_found" ? 404 : 409,
      });
    }
    return Response.json(result);
  } catch {
    // requireRole threw — insufficient role.
    return new Response("forbidden", { status: 403 });
  }
}
