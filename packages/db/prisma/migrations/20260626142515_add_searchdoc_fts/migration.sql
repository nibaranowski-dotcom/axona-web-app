-- SRCH.1 (raw SQL): generated tsvector + GIN for FTS, and the dormant pgvector
-- column + ANN index for SearchDoc. Prisma can't manage tsvector/vector columns
-- or their indexes — authored as a separate migration (never edit an applied one).
-- A later migration must NOT drop these.

-- Weighted tsvector: title (A) > subtitle (B) > body (C). Generated + stored.
ALTER TABLE "SearchDoc" ADD COLUMN "tsv" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("subtitle", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("body", '')), 'C')
  ) STORED;

CREATE INDEX "searchdoc_tsv_gin" ON "SearchDoc" USING gin ("tsv");

-- Dormant semantic path — embeddings populated in FILE.2.
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "SearchDoc" ALTER COLUMN "embedding" TYPE vector(1536);
CREATE INDEX IF NOT EXISTS "searchdoc_embedding_hnsw"
  ON "SearchDoc" USING hnsw ("embedding" vector_cosine_ops);
