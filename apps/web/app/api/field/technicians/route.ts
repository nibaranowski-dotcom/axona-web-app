import { getCurrentUser } from "@/lib/session";
import { listTechnicians } from "@/lib/field-service";

// GET /api/field/technicians?cursor=&take= — org-scoped technician list
// (paginated, with the cert matrix). Read-only.
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
