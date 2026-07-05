-- AUDIT.3 — enrich the immutable event log: an AGENT entry records the model +
-- emitted confidence; a HUMAN approval entry records the approver. All nullable —
-- historical rows keep null. Append-only rules (AUDIT.1) are unaffected.
ALTER TABLE "AuditLog" ADD COLUMN "model" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "confidence" DOUBLE PRECISION;
ALTER TABLE "AuditLog" ADD COLUMN "approverId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "approverLabel" TEXT;
