import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { getProjectMatrix } from "@/lib/matrix";

// GET /api/projects/:id/matrix — files (rows) × columns × answers (value +
// citation + confidence) for MTX.2. Org-scoped read; a cross-org id → 404.
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  const db = dbForOrg(user.orgId);
  const project = await db.project.findFirst({ where: { id: params.id } });
  if (!project) return new Response("not found", { status: 404 });
  return Response.json(await getProjectMatrix(user.orgId, project.id));
}
