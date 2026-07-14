-- ONT.1 — entity-link graph (L1 ontology edge table). Additive only; the
-- SearchDoc FTS/pgvector raw-SQL objects (tsv/GIN/HNSW) are NOT touched here —
-- they live in the committed raw-SQL DDL migrations (MIGRATE.1).

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('NCR', 'ECO', 'PART', 'SUPPLIER', 'PURCHASE_ORDER', 'UNIT', 'LOT', 'DELIVERY', 'WORK_ORDER', 'SPC_SAMPLE', 'INVOICE');

-- CreateEnum
CREATE TYPE "LinkRelation" AS ENUM ('CAUSED_BY', 'AFFECTS', 'RESOLVED_BY', 'SUPPLIED_BY', 'CONTAINS', 'SHIPPED_IN', 'DISPATCHED_FOR', 'IMPACTS');

-- CreateTable
CREATE TABLE "EntityLink" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "fromType" "EntityType" NOT NULL,
    "fromId" TEXT NOT NULL,
    "relation" "LinkRelation" NOT NULL,
    "toType" "EntityType" NOT NULL,
    "toId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntityLink_orgId_fromType_fromId_idx" ON "EntityLink"("orgId", "fromType", "fromId");

-- CreateIndex
CREATE INDEX "EntityLink_orgId_toType_toId_idx" ON "EntityLink"("orgId", "toType", "toId");

-- CreateIndex
CREATE INDEX "EntityLink_orgId_relation_idx" ON "EntityLink"("orgId", "relation");

-- AddForeignKey
ALTER TABLE "EntityLink" ADD CONSTRAINT "EntityLink_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
