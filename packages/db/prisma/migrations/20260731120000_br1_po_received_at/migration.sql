-- BR.1 — Build-readiness + supplier lead-time visibility. Additive-nullable
-- goods-receipt timestamp on PurchaseOrder (MIGRATE.1 — no drops, so the raw-SQL
-- tsv/vector DDL is untouched). promised = eta · actual = receivedAt. Set by the
-- `po.receive` GR action (SENT → RECEIVED); null until received.
ALTER TABLE "PurchaseOrder" ADD COLUMN     "receivedAt" TIMESTAMP(3);
