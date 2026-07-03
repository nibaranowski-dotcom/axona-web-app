-- WF.1 — two bounded additions (PRD §4). Empty table → NOT NULL is safe.

-- AlterEnum: a run parked at a guardrail/approval gate.
ALTER TYPE "RunStatus" ADD VALUE 'AWAITING_APPROVAL';

-- AlterTable: scalar orgId tenancy on WorkflowRun (engine sets it on create).
ALTER TABLE "WorkflowRun" ADD COLUMN "orgId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "WorkflowRun_orgId_idx" ON "WorkflowRun"("orgId");
