/**
 * Verify ATTACH.1 — universal attachments + versioning (extends FILE.1).
 * Static checks always run; DB/S3 checks gate on DATABASE_URL (+ S3). Self-cleaning.
 * Run: pnpm verify:attach-1
 *
 *   1. BUILD-ON-TOP: uses putObject/presignedGetUrl + the FILE.2 extract seam
 *      (enqueueFileExtract→processFile); NO new blob client/@aws-sdk outside
 *      storage.ts, NO second file model, NO new extractor. File is EXTENDED
 *      (nullable-additive) not forked; the migration is additive-only.
 *   2. Attach to an entity ({targetType,targetId}) lists on its panel; org-scoped
 *      (2nd org → 0); download resolves a presigned URL.
 *   3. Versioning: re-upload → v2 current, v1 RETAINED + retrievable, chain shown.
 *   4. Extraction reuse: an attachment runs the SAME FILE.2 processFile (text set).
 *   5. RBAC: upload gated (VIEWER can't); delete admin-only + SOFT (deletedAt).
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;
const check = async (
  label: string,
  fn: () => boolean | Promise<boolean>,
): Promise<void> => {
  try {
    const ok = await fn();
    console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
    ok ? passed++ : failed++;
  } catch (e) {
    console.log(`  FAIL ${label} — ${(e as Error).message}`);
    failed++;
  }
};

const DEMO = "org_axona_demo";
const SECOND = "org_isolation_test";

async function run(): Promise<void> {
  console.log("\nVerifying ATTACH.1 — universal attachments + versioning\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const schema = read("packages/db/prisma/schema.prisma");
  const route = read("apps/web/app/api/attachments/route.ts");
  const idRoute = read("apps/web/app/api/attachments/[id]/route.ts");
  const lib = read("apps/web/lib/attachments.ts");
  const panel = read("apps/web/components/attachments/Attachments.tsx");
  const roles = read("apps/web/lib/attach-roles.ts");

  // ── 1 (static): BUILD-ON-TOP — extend File, reuse storage + FILE.2 ──
  await check(
    "File is EXTENDED (nullable-additive), not forked — one File model",
    () => {
      const fileModel = schema.match(/model File \{([\s\S]*?)\n\}/)?.[1] ?? "";
      return (
        // exactly one file model; no parallel Attachment/FileVersion model
        (schema.match(/\nmodel File \{/g) ?? []).length === 1 &&
        !/model Attachment |model FileVersion /.test(schema) &&
        /projectId String\?/.test(fileModel) && // nullable now
        /targetType String\?/.test(fileModel) &&
        /targetId +String\?/.test(fileModel) &&
        /version +Int +@default\(1\)/.test(fileModel) &&
        /supersedesId String\?/.test(fileModel) &&
        /deletedAt +DateTime\?/.test(fileModel) &&
        /orgId +String\?/.test(fileModel)
      );
    },
  );
  await check(
    "reuse the storage seam — putObject (upload) + presignedGetUrl (download)",
    () => {
      return (
        /putObject\(/.test(route) &&
        /from "@\/lib\/storage"/.test(route) &&
        /presignedGetUrl\(/.test(lib)
      );
    },
  );
  await check(
    "NO new blob client — @aws-sdk / S3Client stays inside storage.ts",
    () => {
      const io = [route, idRoute, lib, panel].join("\n");
      return !/@aws-sdk|new S3Client/.test(io);
    },
  );
  await check(
    "reuse FILE.2 extraction — upload enqueues the SAME extract job; no new extractor",
    () => {
      return (
        /enqueueFileExtract\(/.test(route) && // the FILE.2 seam
        /from "@\/lib\/file-queue"/.test(route) &&
        // ATTACH.1 introduces no parallel extractor
        !/function .*extractText|new .*Extractor|extractText\(/.test(
          [route, idRoute, lib, panel].join("\n"),
        )
      );
    },
  );
  await check(
    "the migration is additive-only (no drops) — File.projectId made nullable",
    () => {
      const dir = join(root, "packages/db/prisma/migrations");
      const mig = existsSync(dir)
        ? readdirSync(dir).find((m) => /attach1_/.test(m))
        : undefined;
      if (!mig) return false;
      const sql = read(`packages/db/prisma/migrations/${mig}/migration.sql`);
      return (
        /ALTER TABLE "File" ALTER COLUMN "projectId" DROP NOT NULL/.test(sql) &&
        /ADD COLUMN "targetType"/.test(sql) &&
        /ADD COLUMN "version"/.test(sql) &&
        // additive: no destructive statements on File/SearchDoc raw-SQL objects
        !/DROP COLUMN|DROP TABLE|DROP INDEX "searchdoc|DROP COLUMN "tsv/.test(
          sql,
        )
      );
    },
  );

  // ── 5 (static): RBAC ──
  await check(
    "RBAC: upload gated to non-VIEWER; delete admin-only + SOFT (deletedAt)",
    () => {
      return (
        /CAN_ATTACH/.test(route) &&
        /requireRole\(user, CAN_ATTACH\)/.test(route) &&
        /export const CAN_ATTACH/.test(roles) &&
        !/"VIEWER"/.test(roles) && // VIEWER not a member of the attach policy
        /CAN_DELETE: Role\[\] = \["ADMIN"\]/.test(idRoute) &&
        /requireRole\(user, CAN_DELETE\)/.test(idRoute) &&
        /deletedAt: new Date\(\)/.test(idRoute) // soft delete, retains blob + row
      );
    },
  );
  await check(
    "the panel is wired on ≥5 detail views (3rd rail beside LINK.1 + HIST.1)",
    () => {
      const views = [
        "apps/web/components/units/UnitView.tsx",
        "apps/web/components/rca/RcaView.tsx",
        "apps/web/components/changes/ChangeOrderView.tsx",
        "apps/web/components/configurations/ConfigurationDetailView.tsx",
        "apps/web/components/tests/TestRunView.tsx",
      ];
      const pages = [
        "apps/web/app/(shell)/units/[serial]/page.tsx",
        "apps/web/app/(shell)/rca/[ncrCode]/page.tsx",
        "apps/web/app/(shell)/changes/[code]/page.tsx",
        "apps/web/app/(shell)/configurations/[code]/page.tsx",
        "apps/web/app/(shell)/tests/[code]/page.tsx",
      ];
      return (
        views.every(
          (f) => /<Attachments/.test(read(f)) && /<RecordHistory/.test(read(f)),
        ) &&
        pages.every((f) => /attachmentsFor\(/.test(read(f))) &&
        /No files attached to this record yet/.test(panel) // empty state
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP data checks — DATABASE_URL not set (static only)");
    finish();
    return;
  }

  const {
    dbForOrg,
    putObject,
    ensureBucket,
    deleteObject,
    processFile,
    FakeEmbedder,
    resolveEntityId,
    s3Configured,
  } = await import("@axona/db");
  const { getRecordAttachments, attachmentDownloadUrl, nextAttachmentVersion } =
    await import("../../apps/web/lib/attachments");

  if (!s3Configured()) {
    console.log("\n  SKIP S3 checks — S3 not configured (static only)");
    finish();
    return;
  }

  const db = dbForOrg(DEMO);
  const ecoId = await resolveEntityId(db, "ECO", "ECO-318");
  const created: string[] = [];
  await ensureBucket();

  // mirrors the upload route's core: putObject (org-prefixed) → File.create
  // (attach fields + version) → processFile (FILE.2 extraction).
  const upload = async (name: string, body: string): Promise<string> => {
    const { version, supersedesId } = await nextAttachmentVersion(db, {
      orgId: DEMO,
      targetType: "ECO",
      targetId: ecoId!,
      name,
    });
    const key = `${DEMO}/attachments/ECO/${ecoId}/${randomUUID()}.txt`;
    await putObject(key, Buffer.from(body), "text/plain");
    const f = await db.file.create({
      data: {
        orgId: DEMO,
        targetType: "ECO",
        targetId: ecoId!,
        name,
        ext: "txt",
        sizeBytes: body.length,
        blobKey: key,
        type: "Spec",
        version,
        supersedesId,
        uploadedById: "verify",
        uploadedByLabel: "Verify User",
        extracted: {},
      },
      select: { id: true },
    });
    created.push(f.id);
    await processFile(
      { fileId: f.id, orgId: DEMO },
      { embedder: new FakeEmbedder() },
    );
    return f.id;
  };

  try {
    // ── 2: attach to an entity → lists + org-scoped ──
    await check(
      "attach to ECO ({targetType,targetId}) lists on its panel; org-scoped (2nd org → 0)",
      async () => {
        const id = await upload("attach-verify.txt", "torque spec 3.5-4.6 Nm");
        const groups = await getRecordAttachments(DEMO, "ECO", ecoId!);
        const g = groups.find((x) => x.name === "attach-verify.txt");
        const iso = await getRecordAttachments(SECOND, "ECO", ecoId!);
        return !!id && !!g && g.current.version === 1 && iso.length === 0;
      },
    );
    await check(
      "download resolves a presigned URL (presignedGetUrl seam)",
      async () => {
        const url = await attachmentDownloadUrl(DEMO, created[0]!);
        const isoUrl = await attachmentDownloadUrl(SECOND, created[0]!); // cross-org → null
        return !!url && /^https?:\/\//.test(url) && isoUrl === null;
      },
    );

    // ── 3: versioning — re-upload → v2 current, v1 retained + retrievable ──
    await check(
      "versioning: re-upload → v2 current; v1 RETAINED + retrievable; the chain is shown",
      async () => {
        const v1 = created[0]!; // "attach-verify.txt" v1 from above
        await upload("attach-verify.txt", "torque spec REVISED 3.6-4.5 Nm"); // v2
        const g = (await getRecordAttachments(DEMO, "ECO", ecoId!)).find(
          (x) => x.name === "attach-verify.txt",
        );
        const v1row = await db.file.findFirst({
          where: { id: v1 },
          select: { version: true, deletedAt: true },
        });
        const v1url = await attachmentDownloadUrl(DEMO, v1); // old version retrievable
        return (
          !!g &&
          g.current.version === 2 &&
          g.versionCount === 2 &&
          g.versions.length === 2 && // chain shown
          !!v1row &&
          v1row.version === 1 &&
          v1row.deletedAt === null && // retained, not overwritten
          !!v1url
        );
      },
    );

    // ── 4: extraction reuse — the SAME FILE.2 processFile extracted text ──
    await check(
      "extraction reuse: the uploaded attachment's text is extracted (FILE.2 processFile, no bypass)",
      async () => {
        const rows = await db.file.findMany({
          where: { id: { in: created } },
          select: { text: true },
        });
        return (
          rows.length >= 2 && rows.every((r) => !!r.text && r.text.length > 0)
        );
      },
    );
  } finally {
    // self-clean: remove the blobs + rows (MIGRATE.1 — leave the seed intact).
    for (const id of created) {
      const f = await db.file.findFirst({
        where: { id },
        select: { blobKey: true },
      });
      if (f) await deleteObject(f.blobKey).catch(() => undefined);
    }
    await db.file.deleteMany({ where: { id: { in: created } } });
    const { prisma } = await import("@axona/db");
    await prisma.$disconnect();
  }

  finish();
}

function finish(): void {
  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run().then(() => process.exit(failed > 0 ? 1 : 0));
