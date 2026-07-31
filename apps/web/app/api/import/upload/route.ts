import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { dbForOrg, importEntity, IMPORT_ENTITIES } from "@axona/db";
import { ensureBucket, putObject, s3Configured } from "@/lib/storage";
import { getCurrentUser } from "@/lib/session";
import { requireRole } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

// IO.2 — blob-backed import: accept a REAL xlsx/csv upload → store it in the FILE.1
// blob store (putObject) → parse SERVER-SIDE via the IO.1 core (parseWorkbook for
// xlsx) → importEntity. No client-side binary parsing. RBAC-gated write + AUDIT.1.
// Reuses FILE.1's client + the IO.1 parser/importer as-is — no second store/parser.
export const dynamic = "force-dynamic";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export async function POST(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    requireRole(user, ["ENGINEER", "ADMIN"]); // imports mutate — RBAC on line 1
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!s3Configured())
    return NextResponse.json(
      { error: "blob store not configured" },
      { status: 503 },
    );

  const { searchParams } = new URL(req.url);
  const entity = searchParams.get("entity") ?? "";
  const mode = searchParams.get("mode") === "upsert" ? "upsert" : undefined;
  const dryRun = searchParams.get("dryrun") === "1";
  const d = IMPORT_ENTITIES[entity];
  if (!d)
    return NextResponse.json(
      { error: `unknown import entity "${entity}"` },
      { status: 400 },
    );

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "expected multipart/form-data" },
      { status: 400 },
    );
  }
  const upload = form.get("file");
  if (!(upload instanceof File))
    return NextResponse.json({ error: "no file uploaded" }, { status: 400 });

  const bytes = Buffer.from(await upload.arrayBuffer());
  const ext = (upload.name.split(".").pop() || "bin").toLowerCase();
  const isCsv = ext === "csv" || (upload.type || "").includes("csv");

  const db = dbForOrg(user.orgId);
  // store the raw upload for provenance (FILE.1) — org-prefixed key.
  const blobKey = `${user.orgId}/imports/${randomUUID()}.${ext}`;
  await ensureBucket();
  await putObject(blobKey, bytes, upload.type || "application/octet-stream");
  await db.file.create({
    data: {
      orgId: user.orgId,
      name: upload.name,
      ext,
      sizeBytes: bytes.length,
      blobKey,
      type: "Data",
      linkedTo: `Import · ${d.label}`,
      extracted: {},
    },
  });

  // parse SERVER-SIDE via the IO.1 core (xlsx → bytes/parseWorkbook · csv → text).
  const result = await importEntity(
    db,
    d,
    isCsv ? { text: bytes.toString("utf8") } : { bytes: new Uint8Array(bytes) },
    { dryRun, mode: mode as "upsert" | undefined },
  );

  if (!dryRun) {
    await writeAudit(db, {
      orgId: user.orgId,
      actor: { type: "HUMAN", id: user.id, label: user.name || user.email },
      action: `${d.entity}.import`,
      target: { type: cap(d.entity), id: blobKey },
      summary: `Imported ${d.label} from uploaded ${ext.toUpperCase()} — ${result.created} created · ${result.updated} updated · ${
        mode === "upsert" ? `${result.skipped} skipped · ` : ""
      }${result.errors.length} rejected`,
      inputs: { blobKey, mode: mode ?? "create" },
      output: {
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        rejected: result.errors.length,
      },
      approver: { id: user.id, label: user.name || user.email },
    });
  }
  return NextResponse.json(result);
}
