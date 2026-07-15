-- MEM.1 (raw SQL, MIGRATE.1) — the MemoryItem vector ANN index. Trailing +
-- idempotent: it runs AFTER 20260715120000_mem1_memory_item created the table +
-- the vector(1536) `embedding` column, and re-asserts the HNSW index the same way
-- the original …_ensure_raw_sql_ddl re-asserts File/SearchDoc. Prisma can't model
-- vector indexes, so they only ever live in raw-SQL migrations. NEVER `db push`.
--
-- (A separate trailing migration — not an edit of 20260704090000_migrate1_ensure_
-- raw_sql_ddl — because that one is already applied and predates this table; editing
-- an applied migration breaks `migrate status`, and its 0704 slot runs before this
-- table exists.)

CREATE EXTENSION IF NOT EXISTS vector;

-- Give MemoryItem.embedding a concrete dimension (Prisma emits a dimensionless
-- `vector`; HNSW requires fixed dims) — same two-step as File/SearchDoc
-- (enable_pgvector_ann). Idempotent: re-typing to the same vector(1536) is a no-op.
ALTER TABLE "MemoryItem" ALTER COLUMN "embedding" TYPE vector(1536);

-- HNSW cosine ANN over the operational-memory embeddings (recallMemory's vector arm).
CREATE INDEX IF NOT EXISTS "memoryitem_embedding_hnsw"
  ON "MemoryItem" USING hnsw ("embedding" vector_cosine_ops);
