import { getCurrentUser } from "@/lib/session";
import { listCampaigns } from "@/lib/marketing";

// GET /api/marketing/campaigns?channel=&cursor=&take= — org-scoped campaign list
// (paginated). Read-only; the marketing screen is MKT.2.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ items: [], nextCursor: null });
  const url = new URL(req.url);
  const channel = url.searchParams.get("channel") ?? undefined;
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const takeRaw = url.searchParams.get("take");
  const take = takeRaw ? Number(takeRaw) : undefined;
  return Response.json(
    await listCampaigns(user.orgId, {
      channel,
      cursor,
      take: Number.isFinite(take) ? take : undefined,
    }),
  );
}
