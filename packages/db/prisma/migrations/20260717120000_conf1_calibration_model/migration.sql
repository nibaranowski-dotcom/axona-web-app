-- CONF.1 — the per-org calibration model (L2 intelligence spine). Additive only;
-- a plain table (no raw-SQL vector/tsv objects), so the MIGRATE.1 ensure migration
-- is untouched. The diff's spurious DROPs of the FTS/pgvector objects are excluded.

-- CreateTable
CREATE TABLE "CalibrationModel" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'org',
    "model" JSONB NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "fittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalibrationModel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalibrationModel_orgId_idx" ON "CalibrationModel"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationModel_orgId_scope_key" ON "CalibrationModel"("orgId", "scope");

-- AddForeignKey
ALTER TABLE "CalibrationModel" ADD CONSTRAINT "CalibrationModel_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
