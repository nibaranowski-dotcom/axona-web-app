-- FILE.2 — the extracted plain-text column (search body + MTX.1 Q&A). Bounded,
-- nullable. ONLY this change (the FTS/pgvector raw-SQL objects are not modelled in
-- schema.prisma; never let migrate diff drop them — MIGRATE.1).
ALTER TABLE "File" ADD COLUMN "text" TEXT;
