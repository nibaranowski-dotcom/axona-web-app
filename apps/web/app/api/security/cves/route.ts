import { getCurrentUser } from "@/lib/session";
import { listCves } from "@/lib/security";

// GET /api/security/cves?status=&severity=&cursor=&take= — org-scoped CVE list
// (paginated). Read-only; the security screen is SEC.2.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ items: [], nextCursor: null });
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const severity = url.searchParams.get("severity") ?? undefined;
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const takeRaw = url.searchParams.get("take");
  const take = takeRaw ? Number(takeRaw) : undefined;
  return Response.json(
    await listCves(user.orgId, {
      status,
      severity,
      cursor,
      take: Number.isFinite(take) ? take : undefined,
    }),
  );
}
