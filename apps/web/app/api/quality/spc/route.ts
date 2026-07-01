import { getCurrentUser } from "@/lib/session";
import { listSpc } from "@/lib/quality";

// GET /api/quality/spc?characteristic=&cursor=&take= — org-scoped SPC samples
// (paginated). Read-only; the control-chart screen is QUAL.2.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ items: [], nextCursor: null });
  const url = new URL(req.url);
  const characteristic = url.searchParams.get("characteristic") ?? undefined;
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const takeRaw = url.searchParams.get("take");
  const take = takeRaw ? Number(takeRaw) : undefined;
  return Response.json(
    await listSpc(user.orgId, {
      characteristic,
      cursor,
      take: Number.isFinite(take) ? take : undefined,
    }),
  );
}
