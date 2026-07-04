import { getCurrentUser } from "@/lib/session";
import { listWorkflows } from "@/lib/workflows";

// GET /api/workflows?moduleKey=&status=&cursor=&take= — org-scoped workflow list
// (paginated). Read-only; running a workflow is WFL.2 / WF.1's enqueue API.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ items: [], nextCursor: null });
  const url = new URL(req.url);
  const moduleKey = url.searchParams.get("moduleKey") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const takeRaw = url.searchParams.get("take");
  const take = takeRaw ? Number(takeRaw) : undefined;
  return Response.json(
    await listWorkflows(user.orgId, {
      moduleKey,
      status,
      cursor,
      take: Number.isFinite(take) ? take : undefined,
    }),
  );
}
