-- PLM.V5 — field modifications. FieldEvent gains the approval lifecycle (state),
-- the human-readable config effect, the machine-readable proposedChange delta, and
-- the technician label. Additive only (MIGRATE.1) — no drops, so the raw-SQL
-- tsv/vector DDL (SearchDoc FTS, File/SearchDoc pgvector) is untouched.

-- AlterTable
ALTER TABLE "FieldEvent" ADD COLUMN     "state" TEXT NOT NULL DEFAULT 'recorded',
ADD COLUMN     "effect" TEXT,
ADD COLUMN     "proposedChange" JSONB,
ADD COLUMN     "techLabel" TEXT;
