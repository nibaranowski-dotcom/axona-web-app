-- LEAD.1 — contact-sales lead capture. A dedicated, AXONA-INTERNAL Lead table (no
-- orgId, no Org FK) so it can never be part of the per-tenant dbForOrg scoping.
-- Additive only (MIGRATE.1 — no drops, so the raw-SQL tsv/vector DDL is untouched).

CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED');

CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "workEmail" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "role" TEXT,
    "fleetSize" TEXT,
    "useCase" TEXT,
    "message" TEXT,
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "ipHash" TEXT,
    "owner" TEXT,
    "note" TEXT,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");
CREATE INDEX "Lead_status_idx" ON "Lead"("status");
CREATE INDEX "Lead_workEmail_company_idx" ON "Lead"("workEmail", "company");
