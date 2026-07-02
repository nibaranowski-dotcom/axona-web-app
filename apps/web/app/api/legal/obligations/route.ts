import { getCurrentUser } from "@/lib/session";
import { listObligations } from "@/lib/legal";

// GET /api/legal/obligations?state=&cursor=&take= — org-scoped obligations vs
// live ops (paginated). Read-only; the screen is LEGAL.2.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ items: [], nextCursor: null });
  const url = new URL(req.url);
  const state = url.searchParams.get("state") ?? undefined;
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const takeRaw = url.searchParams.get("take");
  const take = takeRaw ? Number(takeRaw) : undefined;
  return Response.json(
    await listObligations(user.orgId, {
      state,
      cursor,
      take: Number.isFinite(take) ? take : undefined,
    }),
  );
}
