-- MEM.1 — operational memory (L2 intelligence spine). Additive only. The
-- SearchDoc FTS / pgvector raw-SQL objects (tsv/GIN/HNSW) are NOT touched here —
-- they live in the committed raw-SQL DDL migrations (MIGRATE.1); the diff's
-- spurious DROPs of them (Prisma can't model tsvector/vector) are deliberately
-- excluded. The MemoryItem HNSW index is asserted in the trailing
-- 20260715120100_mem1_ensure_raw_sql_ddl migration (after this table exists).

-- CreateEnum
CREATE TYPE "MemoryKind" AS ENUM ('DECISION', 'EXCEPTION', 'APPROVAL', 'RESOLUTION', 'GENEALOGY_EVENT', 'TELEMETRY_ANOMALY');

-- CreateTable
CREATE TABLE "MemoryItem" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kind" "MemoryKind" NOT NULL,
    "summary" TEXT NOT NULL,
    "subjectType" "EntityType",
    "subjectId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "outcome" TEXT,
    "actorLabel" TEXT,
    "approverLabel" TEXT,
    "model" TEXT,
    "confidence" DOUBLE PRECISION,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "embedding" vector,

    CONSTRAINT "MemoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemoryItem_orgId_kind_occurredAt_idx" ON "MemoryItem"("orgId", "kind", "occurredAt");

-- CreateIndex
CREATE INDEX "MemoryItem_orgId_subjectType_subjectId_idx" ON "MemoryItem"("orgId", "subjectType", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryItem_orgId_sourceType_sourceId_key" ON "MemoryItem"("orgId", "sourceType", "sourceId");

-- AddForeignKey
ALTER TABLE "MemoryItem" ADD CONSTRAINT "MemoryItem_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
