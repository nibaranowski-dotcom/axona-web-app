import { getCurrentUser } from "@/lib/session";
import { listLedger } from "@/lib/finance";

// GET /api/finance/ledger?period=&cursor=&take= — org-scoped ledger entries
// (paginated). Read-only; the P&L screen is FIN.2.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ items: [], nextCursor: null });
  const url = new URL(req.url);
  const period = url.searchParams.get("period") ?? undefined;
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const takeRaw = url.searchParams.get("take");
  const take = takeRaw ? Number(takeRaw) : undefined;
  return Response.json(
    await listLedger(user.orgId, {
      period,
      cursor,
      take: Number.isFinite(take) ? take : undefined,
    }),
  );
}
