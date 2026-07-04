import { randomUUID } from "node:crypto";
import { dbForOrg, Prisma, type Role } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { requireRole } from "@/lib/rbac";
import { getProjectFiles } from "@/lib/projects";
import { ensureBucket, putObject, s3Configured } from "@/lib/storage";

// GET  /api/projects/:id/files — org-scoped file list for a project.
// POST /api/projects/:id/files — upload (multipart `file`): requireRole line 1,
//   org-scoped via project→orgId (never client orgId), stream to MinIO under a
//   deterministic org-prefixed key, then create the File record. No auto-extract
//   here — the extract+embed job is FILE.2. Uploads only through this handler.
/// FILE.2: enqueue the extraction/embedding job after create (leave extracted={} ).
export const dynamic = "force-dynamic";

// Everyone but VIEWER can add files (per-module policy hardens in RBAC.3).
const CAN_UPLOAD: Role[] = [
  "ADMIN",
  "OPS",
  "ENGINEER",
  "SALES",
  "FINANCE",
  "TECH",
];

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ files: [] });
  const db = dbForOrg(user.orgId);
  const project = await db.project.findFirst({ where: { id: params.id } });
  if (!project) return new Response("not found", { status: 404 });
  return Response.json({
    files: await getProjectFiles(user.orgId, project.id),
  });
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  try {
    requireRole(user, CAN_UPLOAD);
  } catch {
    return new Response("forbidden", { status: 403 });
  }
  if (!s3Configured())
    return new Response("blob store unavailable", { status: 503 });

  const db = dbForOrg(user.orgId);
  const project = await db.project.findFirst({ where: { id: params.id } });
  if (!project) return new Response("not found", { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return new Response("expected multipart/form-data", { status: 400 });
  }
  const upload = form.get("file");
  if (!(upload instanceof File))
    return new Response("field `file` is required", { status: 400 });

  const bytes = Buffer.from(await upload.arrayBuffer());
  const ext = (upload.name.split(".").pop() || "bin").toLowerCase();
  // ORG-PREFIXED key → tenant isolation at the storage layer, orgId from session.
  const blobKey = `${user.orgId}/${project.id}/${randomUUID()}.${ext}`;
  const type =
    typeof form.get("type") === "string" ? String(form.get("type")) : "Data";

  await ensureBucket();
  await putObject(blobKey, bytes, upload.type || "application/octet-stream");

  const record = await db.file.create({
    data: {
      projectId: project.id,
      name: upload.name,
      ext,
      sizeBytes: bytes.length,
      blobKey,
      type,
      extracted: {} as Prisma.InputJsonValue, // FILE.2 populates this
    },
    select: {
      id: true,
      name: true,
      ext: true,
      sizeBytes: true,
      type: true,
      modifiedAt: true,
    },
  });
  return Response.json({ file: record }, { status: 201 });
}
