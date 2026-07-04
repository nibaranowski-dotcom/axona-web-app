import { dbForOrg, type Role } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { requireRole } from "@/lib/rbac";
import { deleteObject, s3Configured } from "@/lib/storage";

// DELETE /api/files/:id — RBAC-gated (ADMIN only) hard delete of the object +
// record. Not exposed by default; destructive, so it's the strictest gate.
/// NOTE: a soft-delete (`File.deletedAt` + filtered reads) is the preferred
/// default — deferred (a schema change); flagged in docs/manual-checks.
export const dynamic = "force-dynamic";

const CAN_DELETE: Role[] = ["ADMIN"];

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
    where: { id: params.id, project: { orgId: user.orgId } },
    select: { id: true, blobKey: true },
  });
  if (!file) return new Response("not found", { status: 404 });

  if (s3Configured()) await deleteObject(file.blobKey).catch(() => {});
  await db.file.deleteMany({ where: { id: file.id } });
  return Response.json({ deleted: file.id });
}
