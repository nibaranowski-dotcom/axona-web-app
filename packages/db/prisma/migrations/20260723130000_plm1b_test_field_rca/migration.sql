-- PLM.1b — the deferred tier: TestRun · TestResult · FieldEvent · ChangeRequest,
-- NCR RCA columns (rootCause + unit/test/field links + frozen configSnapshot),
-- ECO.changeRequestId, and the TEST_RUN / FIELD_EVENT EntityType members.
-- Generated via 'prisma migrate diff' (schema-to-schema) so the raw-SQL tsv/
-- vector DDL is untouched (MIGRATE.1). Additive only; no drops.

-- CreateEnum
CREATE TYPE "RootCause" AS ENUM ('software', 'hardware', 'design', 'production', 'component', 'field_modification');
-- CreateEnum
CREATE TYPE "FieldEventKind" AS ENUM ('fault', 'maintenance', 'repair', 'field_modification');
-- CreateEnum
CREATE TYPE "TestOutcome" AS ENUM ('pass', 'fail', 'aborted');
-- CreateEnum
CREATE TYPE "ChangeState" AS ENUM ('draft', 'in_review', 'approved', 'rejected', 'released');
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.
ALTER TYPE "EntityType" ADD VALUE 'TEST_RUN';
ALTER TYPE "EntityType" ADD VALUE 'FIELD_EVENT';
-- AlterTable
ALTER TABLE "NCR" ADD COLUMN     "configSnapshot" JSONB,
ADD COLUMN     "fieldEventId" TEXT,
ADD COLUMN     "rootCause" "RootCause",
ADD COLUMN     "testRunId" TEXT,
ADD COLUMN     "unitId" TEXT;
-- AlterTable
ALTER TABLE "ECO" ADD COLUMN     "changeRequestId" TEXT;
-- CreateTable
CREATE TABLE "TestRun" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "procedure" TEXT NOT NULL,
    "operatorId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "outcome" "TestOutcome" NOT NULL,
    "configSnapshot" JSONB NOT NULL,
    "environment" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestRun_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "TestResult" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "testRunId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "measurement" DOUBLE PRECISION,
    "unitOfMeasure" TEXT,
    "lowerLimit" DOUBLE PRECISION,
    "upperLimit" DOUBLE PRECISION,
    "passed" BOOLEAN NOT NULL,
    CONSTRAINT "TestResult_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "FieldEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "kind" "FieldEventKind" NOT NULL,
    "summary" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "configSnapshot" JSONB NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FieldEvent_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "ChangeRequest" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "state" "ChangeState" NOT NULL DEFAULT 'draft',
    "ecoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "TestRun_orgId_unitId_idx" ON "TestRun"("orgId", "unitId");
-- CreateIndex
CREATE UNIQUE INDEX "TestRun_orgId_code_key" ON "TestRun"("orgId", "code");
-- CreateIndex
CREATE INDEX "TestResult_orgId_testRunId_idx" ON "TestResult"("orgId", "testRunId");
-- CreateIndex
CREATE INDEX "FieldEvent_orgId_unitId_idx" ON "FieldEvent"("orgId", "unitId");
-- CreateIndex
CREATE INDEX "ChangeRequest_orgId_idx" ON "ChangeRequest"("orgId");
-- CreateIndex
CREATE UNIQUE INDEX "ChangeRequest_orgId_code_key" ON "ChangeRequest"("orgId", "code");
-- CreateIndex
CREATE INDEX "NCR_orgId_unitId_idx" ON "NCR"("orgId", "unitId");
-- AddForeignKey
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "FieldEvent" ADD CONSTRAINT "FieldEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "FieldEvent" ADD CONSTRAINT "FieldEvent_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
