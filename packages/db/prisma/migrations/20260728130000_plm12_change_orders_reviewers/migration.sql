-- PLM.12 — Change Orders list. Additive only (MIGRATE.1 — no drops, so the raw-SQL
-- tsv/vector DDL is untouched): ECO gains a change classification, source, and
-- agent-drafted provenance; a new EcoReviewer roster carries per-reviewer approval
-- state (the first-class "awaiting my approval" server-side query).

-- ECO: change classification (SUPERSEDE/REVISE/DEVIATION), source, agent provenance.
ALTER TABLE "ECO" ADD COLUMN     "changeClass" TEXT;
ALTER TABLE "ECO" ADD COLUMN     "source" TEXT;
ALTER TABLE "ECO" ADD COLUMN     "draftedByAgentId" TEXT;
ALTER TABLE "ECO" ADD COLUMN     "confidence" DOUBLE PRECISION;

-- Per-reviewer approval state.
CREATE TYPE "ReviewerState" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE "EcoReviewer" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "ecoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "state" "ReviewerState" NOT NULL DEFAULT 'pending',

    CONSTRAINT "EcoReviewer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EcoReviewer_ecoId_userId_key" ON "EcoReviewer"("ecoId", "userId");
CREATE INDEX "EcoReviewer_orgId_idx" ON "EcoReviewer"("orgId");
CREATE INDEX "EcoReviewer_userId_state_idx" ON "EcoReviewer"("userId", "state");

ALTER TABLE "EcoReviewer" ADD CONSTRAINT "EcoReviewer_ecoId_fkey" FOREIGN KEY ("ecoId") REFERENCES "ECO"("id") ON DELETE CASCADE ON UPDATE CASCADE;
