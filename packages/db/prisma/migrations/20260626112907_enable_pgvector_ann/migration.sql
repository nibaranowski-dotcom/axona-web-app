-- FND.11 (R6/R7): real typed pgvector column + ANN index for File.embedding.
-- Prisma can't manage Unsupported("vector") column types or vector indexes, so
-- this is authored by hand as a separate migration (never edit an applied one).
-- Embedding dimension = 1536 (default; revisit in FILE.2 when the model is set).
-- See docs/manual-checks.md.

-- Belt-and-suspenders: guarantee the extension exists before the vector DDL.
CREATE EXTENSION IF NOT EXISTS vector;

-- Give File.embedding a concrete dimension (column is empty until FILE.2).
ALTER TABLE "File" ALTER COLUMN "embedding" TYPE vector(1536);

-- HNSW cosine ANN index (pgvector >= 0.5): zero-config, good recall at this scale.
CREATE INDEX IF NOT EXISTS "file_embedding_hnsw"
  ON "File" USING hnsw ("embedding" vector_cosine_ops);
