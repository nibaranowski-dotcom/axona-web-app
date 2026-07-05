-- AUDIT.1 — immutable event log. Append-only enforced at the DB (below) AND the
-- writer (writeAudit only INSERTs). Placed before the ensure-raw-sql migration so
-- that migration can re-assert the append-only rules idempotently.

CREATE TYPE "AuditActor" AS ENUM ('HUMAN', 'AGENT', 'SYSTEM');

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "actorType" "AuditActor" NOT NULL,
    "actorId" TEXT,
    "actorLabel" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "inputs" JSONB,
    "output" JSONB,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_orgId_createdAt_idx" ON "AuditLog"("orgId", "createdAt");
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- Append-only: block UPDATE and DELETE at the database. An audit you can edit is
-- not an audit. (DO INSTEAD NOTHING → the statement is a silent no-op.)
CREATE RULE "audit_no_update" AS ON UPDATE TO "AuditLog" DO INSTEAD NOTHING;
CREATE RULE "audit_no_delete" AS ON DELETE TO "AuditLog" DO INSTEAD NOTHING;
