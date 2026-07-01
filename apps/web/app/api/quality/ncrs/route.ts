import { getCurrentUser } from "@/lib/session";
import { listNcrs } from "@/lib/quality";

// GET /api/quality/ncrs?status=&cursor=&take= — org-scoped NCR list (paginated).
// Read-only; NCR mutations/triage live in QUAL.2/RBAC.4.
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
    await listNcrs(user.orgId, {
      status,
      cursor,
      take: Number.isFinite(take) ? take : undefined,
    }),
  );
}
