/**
 * FILE.1 — backfill real placeholder blob objects into MinIO for the seeded File
 * records (whose blobKeys were metadata-only), so downloads work and FILE.2 has
 * bytes to extract. Idempotent (overwrites the same keys). Skips cleanly when the
 * blob store isn't configured. Run: pnpm db:seed:blobs   (after pnpm db:seed)
 */
import { prisma } from "@axona/db";
import {
  ensureBucket,
  putObject,
  s3Configured,
} from "../../apps/web/lib/storage";

const contentTypeFor = (ext: string): string => {
  const e = ext.toLowerCase();
  if (e === "pdf") return "application/pdf";
  if (e === "csv") return "text/csv";
  if (e === "json") return "application/json";
  if (e === "md" || e === "txt") return "text/plain";
  if (e === "docx")
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "application/octet-stream";
};

async function run(): Promise<void> {
  if (!s3Configured()) {
    console.log("S3_ENDPOINT not set — skipping blob backfill.");
    return;
  }
  await ensureBucket();
  const files = await prisma.file.findMany({
    select: {
      id: true,
      name: true,
      ext: true,
      type: true,
      blobKey: true,
      linkedTo: true,
    },
  });
  let n = 0;
  for (const f of files) {
    // A small, real placeholder so a download returns bytes (FILE.2 extracts
    // from these until real uploads replace them).
    const body =
      `Axona placeholder document\n` +
      `================================\n` +
      `File:     ${f.name}\n` +
      `Type:     ${f.type}\n` +
      (f.linkedTo ? `Linked:   ${f.linkedTo}\n` : ``) +
      `Key:      ${f.blobKey}\n\n` +
      `This is seeded placeholder content — real bytes land when the file is\n` +
      `uploaded through POST /api/projects/:id/files. FILE.2 extracts + embeds.\n`;
    await putObject(f.blobKey, body, contentTypeFor(f.ext));
    n++;
  }
  console.log(`Backfilled ${n} placeholder blobs into MinIO.`);
}

run()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
