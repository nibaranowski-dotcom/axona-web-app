-- Runs once on first Postgres init (mounted into /docker-entrypoint-initdb.d).
-- Enables pgvector so packages/db/prisma can rely on the `vector` type (FND.5+).
CREATE EXTENSION IF NOT EXISTS vector;
