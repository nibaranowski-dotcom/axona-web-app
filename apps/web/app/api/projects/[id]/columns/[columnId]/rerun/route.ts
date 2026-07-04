import { dbForOrg, type Role } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { requireRole } from "@/lib/rbac";
import { enqueueMatrixExtract } from "@/lib/matrix-queue";

// POST /api/projects/:id/columns/:columnId/rerun — re-answer a column (idempotent;
// replaces only that column's answers). RBAC-gated; org-scoped.
export const dynamic = "force-dynamic";

const CAN_ADD: Role[] = [
  "ADMIN",
  "OPS",
  "ENGINEER",
  "SALES",
  "FINANCE",
  "TECH",
];

export async function POST(
  _req: Request,
  { params }: { params: { id: string; columnId: string } },
) {
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  try {
    requireRole(user, CAN_ADD);
  } catch {
    return new Response("forbidden", { status: 403 });
  }
  const db = dbForOrg(user.orgId);
  const project = await db.project.findFirst({ where: { id: params.id } });
  if (!project) return new Response("not found", { status: 404 });
  const column = await db.matrixColumn.findFirst({
    where: { id: params.columnId, projectId: project.id },
  });
  if (!column) return new Response("not found", { status: 404 });

  enqueueMatrixExtract({
    projectId: project.id,
    columnId: column.id,
    orgId: user.orgId,
    question: column.question,
  });
  return Response.json({ column });
}
