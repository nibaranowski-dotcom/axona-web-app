import { getCurrentUser } from "@/lib/session";
import { listDeals } from "@/lib/sales";

// GET /api/sales/deals?stage=&cursor=&take= — org-scoped deal list (paginated).
// Read-only; the pipeline screen is SALES.2.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ items: [], nextCursor: null });
  const url = new URL(req.url);
  const stage = url.searchParams.get("stage") ?? undefined;
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const takeRaw = url.searchParams.get("take");
  const take = takeRaw ? Number(takeRaw) : undefined;
  return Response.json(
    await listDeals(user.orgId, {
      stage,
      cursor,
      take: Number.isFinite(take) ? take : undefined,
    }),
  );
}
