/**
 * FILE.2 — backfill: extract + embed every seeded File (their FILE.1 placeholder
 * blobs) so search + MTX.1 have real text + vectors from a fresh seed. Idempotent
 * (processFile upserts). Uses the FakeEmbedder unless EMBED_API_KEY is set; skips
 * cleanly without MinIO. Run: pnpm db:embed:backfill  (after db:seed + db:seed:blobs)
 */
import { prisma, processFile, s3Configured } from "@axona/db";

async function run(): Promise<void> {
  if (!s3Configured()) {
    console.log("S3_ENDPOINT not set — skipping embed backfill.");
    return;
  }
  // A project file joins org via project.orgId; an ATTACH.1 entity attachment
  // carries File.orgId directly (nullable projectId).
  const files = await prisma.file.findMany({
    select: { id: true, orgId: true, project: { select: { orgId: true } } },
  });
  let ok = 0;
  let skipped = 0;
  for (const f of files) {
    const orgId = f.project?.orgId ?? f.orgId;
    if (!orgId) {
      skipped++;
      continue;
    }
    const res = await processFile({ fileId: f.id, orgId });
    if (res.embedded) ok++;
    else skipped++;
  }
  console.log(
    `Embed backfill: ${ok} embedded, ${skipped} skipped (of ${files.length}).`,
  );
}

run()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
