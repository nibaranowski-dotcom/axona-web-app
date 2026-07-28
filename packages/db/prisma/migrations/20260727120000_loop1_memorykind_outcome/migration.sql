-- LOOP.1 — the learning-loop writeback episode kind. A human's verdict on an agent
-- proposal becomes a structured OUTCOME episode in the MEM.1 store (reuses MemoryItem —
-- no new table/store). Additive only (MIGRATE.1): one bounded enum value, no drops, so
-- the raw-SQL tsv/vector DDL (SearchDoc FTS, File/SearchDoc/MemoryItem pgvector) is untouched.
ALTER TYPE "MemoryKind" ADD VALUE 'OUTCOME';
