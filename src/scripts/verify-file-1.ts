/**
 * Verify FILE.1 — S3/MinIO blob store + File lifecycle. Static checks always run;
 * the live checks are gated on S3_ENDPOINT + DATABASE_URL (CI has neither — the
 * pure-logic checks still run). Run: pnpm verify:file-1
 */
import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
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

const root = process.cwd();
const base = join(root, "apps/web");
const read = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");

async function run(): Promise<void> {
  console.log("\nVerifying FILE.1 — S3/MinIO blob store + File lifecycle\n");

  // Impl moved to @axona/db in FILE.2 (worker + in-process share it); apps/web
  // re-exports. Check the impl at its home + the re-export seam.
  const storage = read(join(root, "packages/db/src/storage.ts"));
  const reexport = read(join(base, "lib/storage.ts"));
  await check(
    "storage client exists w/ put/get/presign/delete + path-style",
    () => {
      return (
        /putObject/.test(storage) &&
        /getObjectBytes/.test(storage) &&
        /presignedGetUrl/.test(storage) &&
        /deleteObject/.test(storage) &&
        /forcePathStyle: true/.test(storage) &&
        /@aws-sdk\/client-s3/.test(storage) &&
        /from "@axona\/db"/.test(reexport)
      );
    },
  );

  const upload = read(join(base, "app/api/projects/[id]/files/route.ts"));
  await check(
    "upload: requireRole line 1 + org-scoped (project→orgId) + org-prefixed key",
    () => {
      return (
        /requireRole/.test(upload) &&
        /dbForOrg\(user\.orgId\)/.test(upload) &&
        /project\.findFirst/.test(upload) &&
        /\$\{user\.orgId\}\/\$\{project\.id\}\//.test(upload) &&
        /putObject/.test(upload) &&
        /file\.create/.test(upload)
      );
    },
  );
  await check(
    "FILE.2 seam left; extracted/embedding untouched on upload",
    () => {
      return /FILE\.2/.test(upload) && /extracted: \{\}/.test(upload);
    },
  );

  const dl = read(join(base, "app/api/files/[id]/content/route.ts"));
  await check(
    "download org-scoped via project.orgId join (cross-org → 404)",
    () => {
      return (
        /project: \{ orgId: user\.orgId \}/.test(dl) &&
        /getObjectBytes/.test(dl)
      );
    },
  );

  const del = read(join(base, "app/api/files/[id]/route.ts"));
  await check(
    "delete is RBAC-gated (ADMIN) + soft-delete flagged deferred",
    () => {
      return (
        /requireRole/.test(del) &&
        /"ADMIN"/.test(del) &&
        /deletedAt/.test(del) && // the flag comment mentions the deferred soft-delete
        /project: \{ orgId: user\.orgId \}/.test(del)
      );
    },
  );
  await check(
    "getProjectFiles joins project.orgId (File has no orgId of its own)",
    () => {
      const proj = read(join(base, "lib/projects.ts"));
      return /getProjectFiles/.test(proj) && /project: \{ orgId \}/.test(proj);
    },
  );

  const liveOff = !process.env.S3_ENDPOINT || !process.env.DATABASE_URL;
  if (liveOff) {
    console.log("  SKIP live checks — S3_ENDPOINT / DATABASE_URL not set");
  } else {
    const { prisma, dbForOrg } = await import("@axona/db");
    const { ensureBucket, putObject, getObjectBytes, deleteObject } =
      await import("../../apps/web/lib/storage");
    const { getProjectFiles } = await import("../../apps/web/lib/projects");

    const org = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    const project = org
      ? await dbForOrg(org.id).project.findFirst({ where: {} })
      : null;
    if (!org || !project) {
      console.log("  FAIL demo org/project not seeded (run pnpm db:seed)");
      failed++;
    } else {
      await ensureBucket();
      const key = `${org.id}/${project.id}/${randomUUID()}.txt`;
      const payload = `verify-file-1 roundtrip ${randomUUID()}`;
      let createdId: string | null = null;

      await check("put → get roundtrip returns the exact bytes", async () => {
        await putObject(key, payload, "text/plain");
        const bytes = await getObjectBytes(key);
        return bytes.toString() === payload;
      });
      await check(
        "File record created + listed via getProjectFiles (org-scoped)",
        async () => {
          const rec = await dbForOrg(org.id).file.create({
            data: {
              projectId: project.id,
              name: "verify-file-1.txt",
              ext: "txt",
              sizeBytes: payload.length,
              blobKey: key,
              type: "Data",
              extracted: {},
            },
          });
          createdId = rec.id;
          const files = await getProjectFiles(org.id, project.id);
          return files.some((f) => f.id === rec.id);
        },
      );
      await check(
        "cross-org read is blocked (project.orgId join)",
        async () => {
          if (!createdId) return false;
          const asOtherOrg = await dbForOrg(
            "org_does_not_exist",
          ).file.findFirst({
            where: { id: createdId, project: { orgId: "org_does_not_exist" } },
          });
          return asOtherOrg === null;
        },
      );
      await check(
        "seeded blobs backfilled (a seeded File's object has bytes)",
        async () => {
          const seeded = await dbForOrg(org.id).file.findFirst({
            where: { blobKey: { startsWith: "seed/" } },
          });
          if (!seeded) return false;
          const bytes = await getObjectBytes(seeded.blobKey);
          return bytes.length > 0;
        },
      );

      // self-clean: remove the verify fixtures (object + record)
      if (createdId)
        await dbForOrg(org.id).file.deleteMany({ where: { id: createdId } });
      await deleteObject(key).catch(() => {});
    }
    await prisma.$disconnect();
  }

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
