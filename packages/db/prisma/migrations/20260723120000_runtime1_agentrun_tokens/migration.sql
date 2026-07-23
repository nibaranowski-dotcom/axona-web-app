-- RUNTIME.1 — per-run token observability on AgentRun.
--
-- Three nullable columns populated from the model client's usage (input/output
-- tokens summed across a run's model calls). Nullable so historical runs and
-- runs from a client that doesn't report usage stay valid. A column on the
-- existing AgentRun — AgentRun is tenant-scoped through its Agent, so there is no
-- isolation change (no TENANT_MODELS edit). Idempotent (IF NOT EXISTS) so the
-- migrate1 raw-SQL re-assert pattern never collides with it.

ALTER TABLE "AgentRun" ADD COLUMN IF NOT EXISTS "promptTokens" INTEGER;
ALTER TABLE "AgentRun" ADD COLUMN IF NOT EXISTS "completionTokens" INTEGER;
ALTER TABLE "AgentRun" ADD COLUMN IF NOT EXISTS "totalTokens" INTEGER;
