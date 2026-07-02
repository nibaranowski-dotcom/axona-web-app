import { getCurrentUser } from "@/lib/session";
import { listPolicies } from "@/lib/autonomy";

// GET /api/autonomy/policies?cursor=&take= — org-scoped policy versions
// (paginated). Read-only; policy rollback is a gated action (RBAC.4).
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ items: [], nextCursor: null });
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const takeRaw = url.searchParams.get("take");
  const take = takeRaw ? Number(takeRaw) : undefined;
  return Response.json(
    await listPolicies(user.orgId, {
      cursor,
      take: Number.isFinite(take) ? take : undefined,
    }),
  );
}
