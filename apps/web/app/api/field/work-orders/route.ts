import { getCurrentUser } from "@/lib/session";
import { listWorkOrders } from "@/lib/field-service";

// GET /api/field/work-orders?status=&cursor=&take= — org-scoped field work-order
// list (paginated, with a live SLA countdown). Read-only; the dispatch board is
// FIELD.2.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ items: [], nextCursor: null });
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const takeRaw = url.searchParams.get("take");
  const take = takeRaw ? Number(takeRaw) : undefined;
  return Response.json(
    await listWorkOrders(user.orgId, {
      status,
      cursor,
      take: Number.isFinite(take) ? take : undefined,
    }),
  );
}
