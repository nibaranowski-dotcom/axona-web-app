import { getCurrentUser } from "@/lib/session";
import { listProjects } from "@/lib/projects";

// GET /api/projects?moduleKey=&status=&cursor=&take= — org-scoped project list
// (paginated). Read-only; the file matrix is MTX.2.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ items: [], nextCursor: null });
  const url = new URL(req.url);
  const moduleKey = url.searchParams.get("moduleKey") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const takeRaw = url.searchParams.get("take");
  const take = takeRaw ? Number(takeRaw) : undefined;
  return Response.json(
    await listProjects(user.orgId, {
      moduleKey,
      status,
      cursor,
      take: Number.isFinite(take) ? take : undefined,
    }),
  );
}
