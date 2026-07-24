-- AGT.3 — Agent gains a guardrail config (the moat invariant "guardrails.config is
-- enforced data"). Additive only (MIGRATE.1) — no drops, so the raw-SQL tsv/vector
-- DDL (SearchDoc FTS, File/SearchDoc pgvector) is untouched.

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "guardrails" JSONB;
