-- ATTACH.1 — extend File for universal attachments + versioning. Additive-nullable
-- ONLY (MIGRATE.1 — no drops, so the raw-SQL tsv/vector DDL on File/SearchDoc is
-- untouched). Existing project files keep working (projectId set, scoped via
-- project.orgId); entity/org attachments carry orgId + targetType/targetId.

-- projectId becomes nullable (a file attaches to a project OR an entity OR the org).
ALTER TABLE "File" ALTER COLUMN "projectId" DROP NOT NULL;

-- attach point + versioning + soft-delete + who/when (all nullable / defaulted).
ALTER TABLE "File" ADD COLUMN "orgId" TEXT;
ALTER TABLE "File" ADD COLUMN "targetType" TEXT;
ALTER TABLE "File" ADD COLUMN "targetId" TEXT;
ALTER TABLE "File" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "File" ADD COLUMN "supersedesId" TEXT;
ALTER TABLE "File" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "File" ADD COLUMN "uploadedById" TEXT;
ALTER TABLE "File" ADD COLUMN "uploadedByLabel" TEXT;
ALTER TABLE "File" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- the attach-point query (a record's attachments, org-scoped).
CREATE INDEX "File_orgId_targetType_targetId_idx" ON "File"("orgId", "targetType", "targetId");

-- version-chain self-relation.
ALTER TABLE "File" ADD CONSTRAINT "File_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;
