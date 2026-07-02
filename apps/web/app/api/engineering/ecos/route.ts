import { getCurrentUser } from "@/lib/session";
import { listEcos } from "@/lib/engineering";

// GET /api/engineering/ecos?stage=&cursor=&take= — org-scoped ECO list
// (paginated). Read-only; the ECO board + release approval are ENG.2/RBAC.4.
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
    await listEcos(user.orgId, {
      stage,
      cursor,
      take: Number.isFinite(take) ? take : undefined,
    }),
  );
}
