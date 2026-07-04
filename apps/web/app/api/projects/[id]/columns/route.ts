import { dbForOrg, type Role } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { requireRole } from "@/lib/rbac";
import { enqueueMatrixExtract } from "@/lib/matrix-queue";

// POST /api/projects/:id/columns { question } — MTX.1: create a MatrixColumn then
// fan out extraction across the project's files. requireRole line 1; org-scoped
// via project→orgId. Returns the column immediately; answers fill in async
// (MTX.2 shows an "extracting" state). Each cell is an agent-drafted proposal
// (value + citation + confidence) — never marked approved (RBAC.4/AUDIT.3 seams).
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
  req: Request,
  { params }: { params: { id: string } },
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

  let question = "";
  try {
    const body = await req.json();
    question = typeof body?.question === "string" ? body.question.trim() : "";
  } catch {
    /* no body */
  }
  if (!question) return new Response("question is required", { status: 400 });

  const column = await db.matrixColumn.create({
    data: { projectId: project.id, question, createdBy: user.id },
  });
  enqueueMatrixExtract({
    projectId: project.id,
    columnId: column.id,
    orgId: user.orgId,
    question,
  });
  return Response.json({ column }, { status: 201 });
}
