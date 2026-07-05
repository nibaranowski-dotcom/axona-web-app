import { getAuditTrail } from "@/lib/audit-trail";
import { getCurrentUser } from "@/lib/session";

// GET /api/audit?actor=&action=&targetType=&cursor= — org-scoped, read-only page of
// the immutable audit trail (AUDIT.2). No write path — the log is append-only.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  const url = new URL(req.url);
  const page = await getAuditTrail(user.orgId, {
    actor: url.searchParams.get("actor") ?? undefined,
    action: url.searchParams.get("action") ?? undefined,
    targetType: url.searchParams.get("targetType") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  });
  return Response.json(page);
}
