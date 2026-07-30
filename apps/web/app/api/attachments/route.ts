import { randomUUID } from "node:crypto";
import { dbForOrg, Prisma } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { requireRole } from "@/lib/rbac";
import { ensureBucket, putObject, s3Configured } from "@/lib/storage";
import { enqueueFileExtract } from "@/lib/file-queue";
import { writeAudit } from "@/lib/audit";
import { nextAttachmentVersion } from "@/lib/attachments";
import { CAN_ATTACH } from "@/lib/attach-roles";

// POST /api/attachments — attach a file to any entity ({targetType,targetId}).
// ATTACH.1 = the FILE.1 upload flow generalized: requireRole (all but VIEWER),
// org-prefixed blobKey → putObject (the SAME storage seam), a File row carrying
// {orgId,targetType,targetId} + version (re-upload → N+1, prior RETAINED), then the
// SAME FILE.2 extract enqueue. No new blob store / file model / extractor.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  try {
    requireRole(user, CAN_ATTACH); // line 1 — before any storage/DB write
  } catch {
    return new Response("forbidden", { status: 403 });
  }
  if (!s3Configured())
    return new Response("blob store unavailable", { status: 503 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return new Response("expected multipart/form-data", { status: 400 });
  }
  const upload = form.get("file");
  const targetType = String(form.get("targetType") ?? "");
  const targetId = String(form.get("targetId") ?? "");
  if (!(upload instanceof File))
    return new Response("field `file` is required", { status: 400 });
  if (!targetType || !targetId)
    return new Response("targetType + targetId are required", { status: 400 });

  const bytes = Buffer.from(await upload.arrayBuffer());
  const ext = (upload.name.split(".").pop() || "bin").toLowerCase();
  // ORG-PREFIXED key → tenant isolation at storage; orgId from session, never client.
  const blobKey = `${user.orgId}/attachments/${targetType}/${targetId}/${randomUUID()}.${ext}`;
  const type =
    typeof form.get("type") === "string" ? String(form.get("type")) : "Data";

  const db = dbForOrg(user.orgId);
  const { version, supersedesId } = await nextAttachmentVersion(db, {
    orgId: user.orgId,
    targetType,
    targetId,
    name: upload.name,
  });

  await ensureBucket();
  await putObject(blobKey, bytes, upload.type || "application/octet-stream");

  const record = await db.file.create({
    data: {
      orgId: user.orgId, // File isn't in TENANT_MODELS — set org explicitly
      targetType,
      targetId,
      name: upload.name,
      ext,
      sizeBytes: bytes.length,
      blobKey,
      type,
      version,
      supersedesId,
      uploadedById: user.id,
      uploadedByLabel: user.name || user.email,
      extracted: {} as Prisma.InputJsonValue, // FILE.2 populates this
    },
    select: { id: true, name: true, version: true },
  });

  // AUDIT.1 — target the ENTITY so the upload also surfaces on its HIST.1 history.
  await writeAudit(db, {
    orgId: user.orgId,
    actor: { type: "HUMAN", id: user.id, label: user.name || user.email },
    action: "file.upload",
    target: { type: targetType, id: targetId },
    summary: `attached ${record.name} (v${record.version}) to ${targetType} ${targetId}`,
    output: {
      name: record.name,
      version: record.version,
      sizeBytes: bytes.length,
    },
  });

  // FILE.2 — the SAME extract+embed pipeline (search body + MTX.1 + memory capture).
  enqueueFileExtract(record.id, user.orgId);
  return Response.json({ file: record }, { status: 201 });
}
