import { getCurrentUser } from "@/lib/session";
import { listMatters } from "@/lib/legal";

// GET /api/legal/matters?status=&cursor=&take= — org-scoped legal matters (IP /
// liability), linked to their source modules (paginated). Read-only.
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
    await listMatters(user.orgId, {
      status,
      cursor,
      take: Number.isFinite(take) ? take : undefined,
    }),
  );
}
