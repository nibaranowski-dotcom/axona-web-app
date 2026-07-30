import { dbForOrg, type Role } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { requireRole } from "@/lib/rbac";
import { s3Configured } from "@/lib/storage";
import { writeAudit } from "@/lib/audit";
import { attachmentDownloadUrl } from "@/lib/attachments";

// GET    /api/attachments/:id — download via a short-lived presigned URL (FILE.1
//   presignedGetUrl seam). Org-scoped (entity attachment via File.orgId OR a
//   project file via project.orgId) — a cross-org id is a 404, never a leak.
// DELETE /api/attachments/:id — SOFT delete (RBAC-gated). Sets deletedAt on the
//   whole attach point; blobs + rows are RETAINED (never hard-overwritten).
export const dynamic = "force-dynamic";

const CAN_DELETE: Role[] = ["ADMIN"];

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  if (!s3Configured())
    return new Response("blob store unavailable", { status: 503 });
  const url = await attachmentDownloadUrl(user.orgId, params.id);
  if (!url) return new Response("not found", { status: 404 });
  return Response.redirect(url, 302); // → the presigned MinIO URL
}

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
  const file = await db.file.findFirst({
    where: { id: params.id, orgId: user.orgId },
    select: { id: true, name: true, targetType: true, targetId: true },
  });
  if (!file || !file.targetType || !file.targetId)
    return new Response("not found", { status: 404 });

  // soft-delete every version at this attach point; the blob store is untouched.
  const res = await db.file.updateMany({
    where: {
      orgId: user.orgId,
      targetType: file.targetType,
      targetId: file.targetId,
      name: file.name,
      deletedAt: null,
    },
    data: { deletedAt: new Date() },
  });

  await writeAudit(db, {
    orgId: user.orgId,
    actor: { type: "HUMAN", id: user.id, label: user.name || user.email },
    action: "file.delete",
    target: { type: file.targetType, id: file.targetId },
    summary: `removed attachment ${file.name} (${res.count} version${res.count === 1 ? "" : "s"} retained)`,
  });
  return Response.json({ deleted: res.count });
}
