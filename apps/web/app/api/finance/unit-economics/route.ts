import { getCurrentUser } from "@/lib/session";
import { listUnitEconomics } from "@/lib/finance";

// GET /api/finance/unit-economics?cursor=&take= — org-scoped per-product unit
// economics (paginated). Read-only.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ items: [], nextCursor: null });
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const takeRaw = url.searchParams.get("take");
  const take = takeRaw ? Number(takeRaw) : undefined;
  return Response.json(
    await listUnitEconomics(user.orgId, {
      cursor,
      take: Number.isFinite(take) ? take : undefined,
    }),
  );
}
