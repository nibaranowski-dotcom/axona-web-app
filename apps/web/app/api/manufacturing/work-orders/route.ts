import { getCurrentUser } from "@/lib/session";
import { listWorkOrders } from "@/lib/manufacturing";

// GET /api/manufacturing/work-orders?station=&cursor=&take= — org-scoped MES
// work orders (paginated). Read-only; the line screen is MFG.2.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ items: [], nextCursor: null });
  const url = new URL(req.url);
  const station = url.searchParams.get("station") ?? undefined;
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const takeRaw = url.searchParams.get("take");
  const take = takeRaw ? Number(takeRaw) : undefined;
  return Response.json(
    await listWorkOrders(user.orgId, {
      station,
      cursor,
      take: Number.isFinite(take) ? take : undefined,
    }),
  );
}
