import { getCurrentUser } from "@/lib/session";
import { getProcurementQueue } from "@/lib/procurement";

// GET /api/procurement/pos?status=&cursor=&take= — the org-scoped PO queue
// (POs + joined supplier/part labels + agent-drafted flag + reorder recs).
// Read-only; mutations/approval are PROC.2.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ pos: [], nextCursor: null, reorderCandidates: [] });
  }
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const takeRaw = url.searchParams.get("take");
  const take = takeRaw ? Number(takeRaw) : undefined;

  return Response.json(
    await getProcurementQueue(user.orgId, {
      status,
      cursor,
      take: Number.isFinite(take) ? take : undefined,
    }),
  );
}
