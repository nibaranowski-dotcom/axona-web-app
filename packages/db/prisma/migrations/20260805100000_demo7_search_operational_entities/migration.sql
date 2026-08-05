-- DEMO.7 §3 — index the OPERATIONAL entity classes.
--
-- The Axona agent's `searchOperations` tool queries SearchDoc. SearchType carried only
-- workspace objects (MODULE/AGENT/WORKFLOW/PROJECT/FILE/CHAT), so a purchase order, a
-- lot or a unit was not findable AT ALL — the agent answered "no record exists" about
-- data sitting in the same database. Additive enum values only.
--
-- Hand-authored deliberately (MIGRATE.1): `prisma migrate dev` wanted to DROP the
-- SearchDoc `tsv` generated column + its GIN index, which Prisma cannot model and which
-- the FTS path depends on. Adding enum values touches nothing else.
--
-- ALTER TYPE ... ADD VALUE is transaction-safe on PG12+ so long as the new value is not
-- USED in the same transaction; nothing here writes a row.
ALTER TYPE "SearchType" ADD VALUE IF NOT EXISTS 'UNIT';
ALTER TYPE "SearchType" ADD VALUE IF NOT EXISTS 'PART';
ALTER TYPE "SearchType" ADD VALUE IF NOT EXISTS 'PURCHASE_ORDER';
ALTER TYPE "SearchType" ADD VALUE IF NOT EXISTS 'WORK_ORDER';
ALTER TYPE "SearchType" ADD VALUE IF NOT EXISTS 'NCR';
ALTER TYPE "SearchType" ADD VALUE IF NOT EXISTS 'ECO';
