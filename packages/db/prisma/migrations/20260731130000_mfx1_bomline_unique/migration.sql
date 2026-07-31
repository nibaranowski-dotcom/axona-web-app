-- MFX.1 — additive unique on BomLine's natural key so the IO.1 `bomLine` import
-- descriptor can upsert by (org · model · design revision · position). This is the
-- SAME key importBom already used for idempotency; existing rows are already
-- unique on it (MIGRATE.1 — additive, no drops, raw-SQL tsv/vector DDL untouched).
CREATE UNIQUE INDEX "BomLine_orgId_productModelId_designRevision_position_key" ON "BomLine"("orgId", "productModelId", "designRevision", "position");
