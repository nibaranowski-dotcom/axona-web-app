import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { getObjectBytes, s3Configured } from "@/lib/storage";

// GET /api/files/:id/content — stream a file's bytes from MinIO. Org-scoped:
// File has no orgId, so we JOIN on project.orgId — a cross-org id is a 404, never
// a leak. (A short-lived presigned URL is the CDN path — presignedGetUrl.)
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  if (!s3Configured())
    return new Response("blob store unavailable", { status: 503 });

  const file = await dbForOrg(user.orgId).file.findFirst({
    where: { id: params.id, project: { orgId: user.orgId } },
    select: { name: true, ext: true, blobKey: true, type: true },
  });
  if (!file) return new Response("not found", { status: 404 });

  try {
    const bytes = await getObjectBytes(file.blobKey);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": `inline; filename="${file.name}"`,
        "content-length": String(bytes.length),
      },
    });
  } catch {
    return new Response("object not found", { status: 404 });
  }
}
