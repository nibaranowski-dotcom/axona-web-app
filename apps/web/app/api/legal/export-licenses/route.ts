import { getCurrentUser } from "@/lib/session";
import { listExportLicenses } from "@/lib/legal";

// GET /api/legal/export-licenses?cursor=&take= — org-scoped export licenses
// (paginated). Read-only.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ items: [], nextCursor: null });
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const takeRaw = url.searchParams.get("take");
  const take = takeRaw ? Number(takeRaw) : undefined;
  return Response.json(
    await listExportLicenses(user.orgId, {
      cursor,
      take: Number.isFinite(take) ? take : undefined,
    }),
  );
}
