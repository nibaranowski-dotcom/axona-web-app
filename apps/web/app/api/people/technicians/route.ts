import { getCurrentUser } from "@/lib/session";
import { listTechnicians } from "@/lib/people";

// GET /api/people/technicians?cursor=&take= — org-scoped technician roster with
// the parsed cert matrix (paginated). Read-only; the cert-matrix screen is PPL.2.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ items: [], nextCursor: null });
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const takeRaw = url.searchParams.get("take");
  const take = takeRaw ? Number(takeRaw) : undefined;
  return Response.json(
    await listTechnicians(user.orgId, {
      cursor,
      take: Number.isFinite(take) ? take : undefined,
    }),
  );
}
