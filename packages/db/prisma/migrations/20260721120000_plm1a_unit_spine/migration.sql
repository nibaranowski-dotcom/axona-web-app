-- PLM.1a — the Unit spine + as-designed BOM + as-built + time-resolved config.
-- Authored from `prisma migrate diff` MINUS the raw-SQL churn Prisma cannot model
-- (SearchDoc FTS tsv+GIN, File/SearchDoc/MemoryItem pgvector HNSW) — those live in
-- the trailing *_ensure_raw_sql_ddl migrations (MIGRATE.1); never dropped here.

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('in_build', 'in_test', 'deployed', 'active', 'decommissioned');

-- CreateEnum
CREATE TYPE "EcoRolloutStatus" AS ENUM ('pending', 'in_progress', 'complete');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.

ALTER TYPE "EntityType" ADD VALUE 'PRODUCT_MODEL';
ALTER TYPE "EntityType" ADD VALUE 'PART_REVISION';
ALTER TYPE "EntityType" ADD VALUE 'CONFIG_VERSION';

-- AlterTable
ALTER TABLE "ECO" ADD COLUMN     "effectiveFromDate" TIMESTAMP(3),
ADD COLUMN     "effectiveFromSerial" TEXT,
ADD COLUMN     "rolloutStatus" "EcoRolloutStatus" NOT NULL DEFAULT 'pending';

-- CreateTable
CREATE TABLE "ProductModel" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designRevision" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartMaster" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "lifecycleStatus" TEXT NOT NULL,
    "approvedVendorIds" TEXT[],

    CONSTRAINT "PartMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartRevision" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "partMasterId" TEXT NOT NULL,
    "rev" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "originatingEcoId" TEXT,

    CONSTRAINT "PartRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BomLine" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "productModelId" TEXT NOT NULL,
    "designRevision" TEXT NOT NULL,
    "parentLineId" TEXT,
    "position" TEXT NOT NULL,
    "partRevisionId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,

    CONSTRAINT "BomLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "productModelId" TEXT NOT NULL,
    "buildDate" TIMESTAMP(3),
    "status" "UnitStatus" NOT NULL,
    "siteLabel" TEXT,
    "customerLabel" TEXT,
    "workOrderMfgId" TEXT,
    "robotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsBuiltRecord" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "bomPosition" TEXT NOT NULL,
    "partRevisionId" TEXT NOT NULL,
    "lotCode" TEXT,
    "componentSerial" TEXT,
    "installedById" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL,
    "isSubstitution" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,

    CONSTRAINT "AsBuiltRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoftwareRelease" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "SoftwareRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitSoftwareState" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "softwareReleaseId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),

    CONSTRAINT "UnitSoftwareState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigurationVersion" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productModelId" TEXT NOT NULL,
    "hwSpec" JSONB NOT NULL,
    "swSpec" JSONB NOT NULL,
    "isBaseline" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "lockedById" TEXT,

    CONSTRAINT "ConfigurationVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductModel_orgId_idx" ON "ProductModel"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductModel_orgId_code_key" ON "ProductModel"("orgId", "code");

-- CreateIndex
CREATE INDEX "PartMaster_orgId_idx" ON "PartMaster"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "PartMaster_orgId_partNumber_key" ON "PartMaster"("orgId", "partNumber");

-- CreateIndex
CREATE INDEX "PartRevision_orgId_idx" ON "PartRevision"("orgId");

-- CreateIndex
CREATE INDEX "PartRevision_partMasterId_idx" ON "PartRevision"("partMasterId");

-- CreateIndex
CREATE UNIQUE INDEX "PartRevision_orgId_partMasterId_rev_key" ON "PartRevision"("orgId", "partMasterId", "rev");

-- CreateIndex
CREATE INDEX "BomLine_orgId_idx" ON "BomLine"("orgId");

-- CreateIndex
CREATE INDEX "BomLine_productModelId_designRevision_idx" ON "BomLine"("productModelId", "designRevision");

-- CreateIndex
CREATE INDEX "Unit_orgId_idx" ON "Unit"("orgId");

-- CreateIndex
CREATE INDEX "Unit_orgId_status_idx" ON "Unit"("orgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_orgId_serial_key" ON "Unit"("orgId", "serial");

-- CreateIndex
CREATE INDEX "AsBuiltRecord_orgId_unitId_idx" ON "AsBuiltRecord"("orgId", "unitId");

-- CreateIndex
CREATE INDEX "AsBuiltRecord_orgId_lotCode_idx" ON "AsBuiltRecord"("orgId", "lotCode");

-- CreateIndex
CREATE INDEX "SoftwareRelease_orgId_idx" ON "SoftwareRelease"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "SoftwareRelease_orgId_component_version_key" ON "SoftwareRelease"("orgId", "component", "version");

-- CreateIndex
CREATE INDEX "UnitSoftwareState_orgId_unitId_idx" ON "UnitSoftwareState"("orgId", "unitId");

-- CreateIndex
CREATE INDEX "UnitSoftwareState_unitId_effectiveFrom_idx" ON "UnitSoftwareState"("unitId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "ConfigurationVersion_orgId_idx" ON "ConfigurationVersion"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigurationVersion_orgId_name_key" ON "ConfigurationVersion"("orgId", "name");

-- AddForeignKey
ALTER TABLE "ProductModel" ADD CONSTRAINT "ProductModel_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartMaster" ADD CONSTRAINT "PartMaster_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartRevision" ADD CONSTRAINT "PartRevision_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartRevision" ADD CONSTRAINT "PartRevision_partMasterId_fkey" FOREIGN KEY ("partMasterId") REFERENCES "PartMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomLine" ADD CONSTRAINT "BomLine_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomLine" ADD CONSTRAINT "BomLine_productModelId_fkey" FOREIGN KEY ("productModelId") REFERENCES "ProductModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomLine" ADD CONSTRAINT "BomLine_parentLineId_fkey" FOREIGN KEY ("parentLineId") REFERENCES "BomLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomLine" ADD CONSTRAINT "BomLine_partRevisionId_fkey" FOREIGN KEY ("partRevisionId") REFERENCES "PartRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_productModelId_fkey" FOREIGN KEY ("productModelId") REFERENCES "ProductModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsBuiltRecord" ADD CONSTRAINT "AsBuiltRecord_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsBuiltRecord" ADD CONSTRAINT "AsBuiltRecord_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsBuiltRecord" ADD CONSTRAINT "AsBuiltRecord_partRevisionId_fkey" FOREIGN KEY ("partRevisionId") REFERENCES "PartRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoftwareRelease" ADD CONSTRAINT "SoftwareRelease_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitSoftwareState" ADD CONSTRAINT "UnitSoftwareState_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitSoftwareState" ADD CONSTRAINT "UnitSoftwareState_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitSoftwareState" ADD CONSTRAINT "UnitSoftwareState_softwareReleaseId_fkey" FOREIGN KEY ("softwareReleaseId") REFERENCES "SoftwareRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigurationVersion" ADD CONSTRAINT "ConfigurationVersion_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigurationVersion" ADD CONSTRAINT "ConfigurationVersion_productModelId_fkey" FOREIGN KEY ("productModelId") REFERENCES "ProductModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
