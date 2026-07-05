-- MIGRATE.1 (raw SQL): re-assert EVERY hand-authored raw-SQL object idempotently,
-- as the final step of `migrate deploy`, so a fresh database reproduces the FTS +
-- pgvector DDL exactly regardless of earlier-migration ordering quirks.
--
-- Why this exists: the File HNSW index (from enable_pgvector_ann) did not persist
-- on a clean `migrate reset` even though its SQL is correct — and a historical
-- `prisma db push` had silently dropped these objects in the live DB (the cause of
-- the /search 500). Prisma can't model tsvector/vector columns + their indexes, so
-- they only live in raw-SQL migrations; asserting them here (after all tables and
-- ALTERs exist) makes `migrate deploy` the single, drift-proof schema path.
-- NEVER `prisma db push` — it drops everything below. Use `migrate dev/deploy`.

CREATE EXTENSION IF NOT EXISTS vector;

-- SearchDoc FTS: the generated tsvector column + its GIN index.
ALTER TABLE "SearchDoc"
  ADD COLUMN IF NOT EXISTS "tsv" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("subtitle", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("body", '')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS "searchdoc_tsv_gin" ON "SearchDoc" USING gin ("tsv");

-- pgvector ANN indexes (dormant until FILE.2 populates the embeddings).
CREATE INDEX IF NOT EXISTS "searchdoc_embedding_hnsw"
  ON "SearchDoc" USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX IF NOT EXISTS "file_embedding_hnsw"
  ON "File" USING hnsw ("embedding" vector_cosine_ops);

-- AUDIT.1 append-only rules (re-asserted idempotently; the "AuditLog" table is
-- created in the preceding audit1 migration). CREATE OR REPLACE RULE is idempotent
-- — this keeps the immutability guarantee drift-proof under `migrate deploy`.
CREATE OR REPLACE RULE "audit_no_update" AS ON UPDATE TO "AuditLog" DO INSTEAD NOTHING;
CREATE OR REPLACE RULE "audit_no_delete" AS ON DELETE TO "AuditLog" DO INSTEAD NOTHING;
