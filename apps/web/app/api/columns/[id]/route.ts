import { dbForOrg, type Role } from "@axona/db";
import { removeColumnAnswers } from "@axona/agents";
import { getCurrentUser } from "@/lib/session";
import { requireRole } from "@/lib/rbac";

// DELETE /api/columns/:id — remove the MatrixColumn + its answers from every
// File.extracted in the project. RBAC-gated (ADMIN/OPS/ENGINEER); org-scoped via
// project→orgId (a cross-org column is a 404).
export const dynamic = "force-dynamic";

const CAN_DELETE: Role[] = ["ADMIN", "OPS", "ENGINEER"];

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  try {
    requireRole(user, CAN_DELETE);
  } catch {
    return new Response("forbidden", { status: 403 });
  }
  const db = dbForOrg(user.orgId);
  const column = await db.matrixColumn.findFirst({
    where: { id: params.id },
    select: { id: true, projectId: true },
  });
  // Org guard: confirm the column's project is in this org (MatrixColumn has no
  // orgId/relation — a cross-org column is a 404, never touched).
  const owned = column
    ? await db.project.findFirst({
        where: { id: column.projectId },
        select: { id: true },
      })
    : null;
  if (!column || !owned) return new Response("not found", { status: 404 });

  await removeColumnAnswers(user.orgId, column.projectId, column.id);
  await db.matrixColumn.deleteMany({ where: { id: column.id } });
  return Response.json({ deleted: column.id });
}
