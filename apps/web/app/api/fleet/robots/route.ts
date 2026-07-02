import { getCurrentUser } from "@/lib/session";
import { listRobots } from "@/lib/fleet";

// GET /api/fleet/robots?status=&cursor=&take= — org-scoped robot list
// (paginated). Read-only; the map/telemetry screen is FLEET.2.
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
    await listRobots(user.orgId, {
      status,
      cursor,
      take: Number.isFinite(take) ? take : undefined,
    }),
  );
}
