-- PLM.11 — Configuration detail: additive baseline/lineage fields on
-- ConfigurationVersion (MIGRATE.1 — no drops, so the raw-SQL tsv/vector DDL is
-- untouched). Dual-approver lock (first proposer + finalizing approver), a frozen
-- manifest snapshot at lock time (immutability, TestRun.configSnapshot pattern), and
-- a self-relation lineage (supersedes / supersededBy).
ALTER TABLE "ConfigurationVersion" ADD COLUMN     "lockProposedById" TEXT;
ALTER TABLE "ConfigurationVersion" ADD COLUMN     "lockProposedAt" TIMESTAMP(3);
ALTER TABLE "ConfigurationVersion" ADD COLUMN     "frozenManifest" JSONB;
ALTER TABLE "ConfigurationVersion" ADD COLUMN     "supersedesId" TEXT;

CREATE INDEX "ConfigurationVersion_supersedesId_idx" ON "ConfigurationVersion"("supersedesId");

ALTER TABLE "ConfigurationVersion" ADD CONSTRAINT "ConfigurationVersion_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "ConfigurationVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
