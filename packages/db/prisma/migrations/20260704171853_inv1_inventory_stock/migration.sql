-- INV.1 — multi-echelon inventory stock + days-of-cover consumption stand-in.
-- ONLY the intended changes: the FTS/pgvector raw-SQL objects are NOT modelled in
-- schema.prisma, so `migrate diff` wants to drop them — never let it. (MIGRATE.1)

-- CreateEnum
CREATE TYPE "InventoryKind" AS ENUM ('CENTRAL', 'LINE_SIDE', 'EDGE_CACHE', 'FINISHED_GOODS', 'PLANT');

-- AlterTable: days-of-cover consumption stand-in (units/day).
ALTER TABLE "Part" ADD COLUMN "dailyUse" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "InventoryStock" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "kind" "InventoryKind" NOT NULL,
    "onHand" INTEGER NOT NULL,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "minLevel" INTEGER NOT NULL DEFAULT 0,
    "valueUsd" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InventoryStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryStock_orgId_idx" ON "InventoryStock"("orgId");

-- CreateIndex
CREATE INDEX "InventoryStock_partId_idx" ON "InventoryStock"("partId");
