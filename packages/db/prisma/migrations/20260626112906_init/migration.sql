-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'OPS', 'ENGINEER', 'SALES', 'FINANCE', 'TECH', 'VIEWER');

-- CreateEnum
CREATE TYPE "ModuleGroup" AS ENUM ('CORE', 'VALUE_CHAIN', 'ROBOTICS', 'BACK_OFFICE');

-- CreateEnum
CREATE TYPE "AgentState" AS ENUM ('LIVE', 'WORKING', 'CRITICAL', 'OFFLINE');

-- CreateEnum
CREATE TYPE "MsgRole" AS ENUM ('USER', 'AGENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'IN_REVIEW', 'BLOCKED', 'DONE');

-- CreateEnum
CREATE TYPE "MachineKind" AS ENUM ('FIXED', 'MOBILE');

-- CreateEnum
CREATE TYPE "MachineStatus" AS ENUM ('RUNNING', 'IDLE', 'MAINTENANCE', 'CHARGING', 'FAULT');

-- CreateEnum
CREATE TYPE "HealthLevel" AS ENUM ('OK', 'WATCH', 'BAD');

-- CreateEnum
CREATE TYPE "POStatus" AS ENUM ('DRAFTED', 'AWAITING_APPROVAL', 'APPROVED', 'SENT', 'RECEIVED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('MINOR', 'MAJOR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DealStage" AS ENUM ('QUALIFY', 'DEMO', 'PROPOSAL', 'NEGOTIATION', 'COMMIT');

-- CreateEnum
CREATE TYPE "Feasibility" AS ENUM ('ON_TIME', 'AT_RISK', 'NOT_CHECKED');

-- CreateEnum
CREATE TYPE "DeliveryStage" AS ENUM ('ALLOC', 'CRATE', 'FREIGHT', 'CUSTOMS', 'ONSITE', 'COMMISSION', 'ACTIVE');

-- CreateTable
CREATE TABLE "Org" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Org_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" "ModuleGroup" NOT NULL,
    "orderIndex" INTEGER NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "state" "AgentState" NOT NULL DEFAULT 'LIVE',

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chat" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "agentId" TEXT,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "role" "MsgRole" NOT NULL,
    "text" TEXT NOT NULL,
    "citations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "trigger" JSONB NOT NULL,
    "steps" JSONB NOT NULL,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRun" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL,
    "trace" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "trace" JSONB NOT NULL,
    "status" "RunStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL,
    "members" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ext" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "blobKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "linkedTo" TEXT,
    "extracted" JSONB NOT NULL,
    "embedding" vector,
    "modifiedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatrixColumn" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatrixColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "MachineKind" NOT NULL,
    "category" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "status" "MachineStatus" NOT NULL,
    "utilization" INTEGER NOT NULL,
    "health" TEXT NOT NULL,
    "healthLevel" "HealthLevel" NOT NULL,
    "telemetryOnline" BOOLEAN NOT NULL,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineSignal" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "MachineSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "riskScore" DOUBLE PRECISION NOT NULL,
    "onTimePct" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Part" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "onHand" INTEGER NOT NULL,
    "reorderPoint" INTEGER NOT NULL,
    "leadDays" INTEGER NOT NULL,

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "status" "POStatus" NOT NULL,
    "draftedByAgentId" TEXT,
    "eta" TIMESTAMP(3),

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderMfg" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "station" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),

    CONSTRAINT "WorkOrderMfg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NCR" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "defect" TEXT NOT NULL,
    "linkedTo" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "NCR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpcSample" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "characteristic" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "ucl" DOUBLE PRECISION NOT NULL,
    "lcl" DOUBLE PRECISION NOT NULL,
    "mean" DOUBLE PRECISION NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpcSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cert" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "Cert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "stage" "DealStage" NOT NULL,
    "closeDate" TIMESTAMP(3),
    "feasibility" "Feasibility" NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "mqls" INTEGER NOT NULL,
    "pipeline" DOUBLE PRECISION NOT NULL,
    "roi" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "units" TEXT NOT NULL,
    "stage" "DeliveryStage" NOT NULL,
    "committedDate" TIMESTAMP(3) NOT NULL,
    "etaDate" TIMESTAMP(3) NOT NULL,
    "riskState" TEXT NOT NULL,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Robot" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "uptimePct" DOUBLE PRECISION NOT NULL,
    "firmware" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,

    CONSTRAINT "Robot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelemetryPoint" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "robotId" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "TelemetryPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderField" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "robotSerial" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "issue" TEXT NOT NULL,
    "slaDueAt" TIMESTAMP(3),
    "techId" TEXT,
    "status" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,

    CONSTRAINT "WorkOrderField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Technician" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "initials" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "certs" JSONB NOT NULL,

    CONSTRAINT "Technician_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ECO" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "affected" TEXT NOT NULL,
    "stage" TEXT NOT NULL,

    CONSTRAINT "ECO_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirmwareRelease" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "state" TEXT NOT NULL,

    CONSTRAINT "FirmwareRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompatCell" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "hwRev" TEXT NOT NULL,
    "fwVersion" TEXT NOT NULL,
    "state" TEXT NOT NULL,

    CONSTRAINT "CompatCell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutonomyMetric" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "autonomyRate" DOUBLE PRECISION NOT NULL,
    "takeoversPer1k" DOUBLE PRECISION NOT NULL,
    "policyVersion" TEXT NOT NULL,

    CONSTRAINT "AutonomyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyIncident" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "robotSerial" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "SafetyIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyVersion" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "state" TEXT NOT NULL,

    CONSTRAINT "PolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "kind" TEXT NOT NULL,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "terms" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitEconomic" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "asp" DOUBLE PRECISION NOT NULL,
    "cogs" DOUBLE PRECISION NOT NULL,
    "marginPct" DOUBLE PRECISION NOT NULL,
    "trend" TEXT NOT NULL,

    CONSTRAINT "UnitEconomic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requisition" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "filled" INTEGER NOT NULL,
    "target" INTEGER NOT NULL,

    CONSTRAINT "Requisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CVE" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "affectedUnits" INTEGER NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "CVE_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Obligation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "obligation" TEXT NOT NULL,
    "actual" TEXT NOT NULL,
    "state" TEXT NOT NULL,

    CONSTRAINT "Obligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportLicense" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "state" TEXT NOT NULL,

    CONSTRAINT "ExportLicense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalMatter" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "linkedTo" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "LegalMatter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_orgId_idx" ON "User"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Module_key_key" ON "Module"("key");

-- CreateIndex
CREATE INDEX "Agent_orgId_idx" ON "Agent"("orgId");

-- CreateIndex
CREATE INDEX "Chat_orgId_idx" ON "Chat"("orgId");

-- CreateIndex
CREATE INDEX "Chat_agentId_idx" ON "Chat"("agentId");

-- CreateIndex
CREATE INDEX "Chat_userId_idx" ON "Chat"("userId");

-- CreateIndex
CREATE INDEX "Message_chatId_idx" ON "Message"("chatId");

-- CreateIndex
CREATE INDEX "Workflow_orgId_idx" ON "Workflow"("orgId");

-- CreateIndex
CREATE INDEX "WorkflowRun_workflowId_idx" ON "WorkflowRun"("workflowId");

-- CreateIndex
CREATE INDEX "AgentRun_agentId_idx" ON "AgentRun"("agentId");

-- CreateIndex
CREATE INDEX "Project_orgId_idx" ON "Project"("orgId");

-- CreateIndex
CREATE INDEX "File_projectId_idx" ON "File"("projectId");

-- CreateIndex
CREATE INDEX "MatrixColumn_projectId_idx" ON "MatrixColumn"("projectId");

-- CreateIndex
CREATE INDEX "Machine_orgId_idx" ON "Machine"("orgId");

-- CreateIndex
CREATE INDEX "MachineSignal_machineId_ts_idx" ON "MachineSignal"("machineId", "ts");

-- CreateIndex
CREATE INDEX "Supplier_orgId_idx" ON "Supplier"("orgId");

-- CreateIndex
CREATE INDEX "Part_orgId_idx" ON "Part"("orgId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_orgId_idx" ON "PurchaseOrder"("orgId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_partId_idx" ON "PurchaseOrder"("partId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_draftedByAgentId_idx" ON "PurchaseOrder"("draftedByAgentId");

-- CreateIndex
CREATE INDEX "WorkOrderMfg_orgId_idx" ON "WorkOrderMfg"("orgId");

-- CreateIndex
CREATE INDEX "NCR_orgId_idx" ON "NCR"("orgId");

-- CreateIndex
CREATE INDEX "SpcSample_orgId_idx" ON "SpcSample"("orgId");

-- CreateIndex
CREATE INDEX "SpcSample_characteristic_ts_idx" ON "SpcSample"("characteristic", "ts");

-- CreateIndex
CREATE INDEX "Cert_orgId_idx" ON "Cert"("orgId");

-- CreateIndex
CREATE INDEX "Deal_orgId_idx" ON "Deal"("orgId");

-- CreateIndex
CREATE INDEX "Campaign_orgId_idx" ON "Campaign"("orgId");

-- CreateIndex
CREATE INDEX "Delivery_orgId_idx" ON "Delivery"("orgId");

-- CreateIndex
CREATE INDEX "Delivery_stage_idx" ON "Delivery"("stage");

-- CreateIndex
CREATE INDEX "Robot_orgId_idx" ON "Robot"("orgId");

-- CreateIndex
CREATE INDEX "TelemetryPoint_orgId_idx" ON "TelemetryPoint"("orgId");

-- CreateIndex
CREATE INDEX "TelemetryPoint_robotId_ts_idx" ON "TelemetryPoint"("robotId", "ts");

-- CreateIndex
CREATE INDEX "WorkOrderField_orgId_idx" ON "WorkOrderField"("orgId");

-- CreateIndex
CREATE INDEX "WorkOrderField_techId_idx" ON "WorkOrderField"("techId");

-- CreateIndex
CREATE INDEX "WorkOrderField_slaDueAt_idx" ON "WorkOrderField"("slaDueAt");

-- CreateIndex
CREATE INDEX "Technician_orgId_idx" ON "Technician"("orgId");

-- CreateIndex
CREATE INDEX "ECO_orgId_idx" ON "ECO"("orgId");

-- CreateIndex
CREATE INDEX "FirmwareRelease_orgId_idx" ON "FirmwareRelease"("orgId");

-- CreateIndex
CREATE INDEX "CompatCell_orgId_idx" ON "CompatCell"("orgId");

-- CreateIndex
CREATE INDEX "CompatCell_hwRev_fwVersion_idx" ON "CompatCell"("hwRev", "fwVersion");

-- CreateIndex
CREATE INDEX "AutonomyMetric_orgId_idx" ON "AutonomyMetric"("orgId");

-- CreateIndex
CREATE INDEX "AutonomyMetric_site_ts_idx" ON "AutonomyMetric"("site", "ts");

-- CreateIndex
CREATE INDEX "SafetyIncident_orgId_idx" ON "SafetyIncident"("orgId");

-- CreateIndex
CREATE INDEX "PolicyVersion_orgId_idx" ON "PolicyVersion"("orgId");

-- CreateIndex
CREATE INDEX "LedgerEntry_orgId_idx" ON "LedgerEntry"("orgId");

-- CreateIndex
CREATE INDEX "Invoice_orgId_idx" ON "Invoice"("orgId");

-- CreateIndex
CREATE INDEX "UnitEconomic_orgId_idx" ON "UnitEconomic"("orgId");

-- CreateIndex
CREATE INDEX "Requisition_orgId_idx" ON "Requisition"("orgId");

-- CreateIndex
CREATE INDEX "CVE_orgId_idx" ON "CVE"("orgId");

-- CreateIndex
CREATE INDEX "Obligation_orgId_idx" ON "Obligation"("orgId");

-- CreateIndex
CREATE INDEX "ExportLicense_orgId_idx" ON "ExportLicense"("orgId");

-- CreateIndex
CREATE INDEX "LegalMatter_orgId_idx" ON "LegalMatter"("orgId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineSignal" ADD CONSTRAINT "MachineSignal_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_draftedByAgentId_fkey" FOREIGN KEY ("draftedByAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderMfg" ADD CONSTRAINT "WorkOrderMfg_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NCR" ADD CONSTRAINT "NCR_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpcSample" ADD CONSTRAINT "SpcSample_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cert" ADD CONSTRAINT "Cert_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Robot" ADD CONSTRAINT "Robot_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelemetryPoint" ADD CONSTRAINT "TelemetryPoint_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelemetryPoint" ADD CONSTRAINT "TelemetryPoint_robotId_fkey" FOREIGN KEY ("robotId") REFERENCES "Robot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderField" ADD CONSTRAINT "WorkOrderField_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderField" ADD CONSTRAINT "WorkOrderField_techId_fkey" FOREIGN KEY ("techId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Technician" ADD CONSTRAINT "Technician_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ECO" ADD CONSTRAINT "ECO_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmwareRelease" ADD CONSTRAINT "FirmwareRelease_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompatCell" ADD CONSTRAINT "CompatCell_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutonomyMetric" ADD CONSTRAINT "AutonomyMetric_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyIncident" ADD CONSTRAINT "SafetyIncident_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyVersion" ADD CONSTRAINT "PolicyVersion_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitEconomic" ADD CONSTRAINT "UnitEconomic_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CVE" ADD CONSTRAINT "CVE_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obligation" ADD CONSTRAINT "Obligation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportLicense" ADD CONSTRAINT "ExportLicense_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalMatter" ADD CONSTRAINT "LegalMatter_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
