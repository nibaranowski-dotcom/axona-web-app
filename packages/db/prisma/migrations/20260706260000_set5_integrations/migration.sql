-- SET.5 — integrations / SSO config / API keys (keys hashed at rest).
CREATE TYPE "IntegrationKind" AS ENUM ('ERP', 'PLM', 'MES', 'SLACK', 'EMAIL', 'TELEMETRY');
CREATE TYPE "IntegrationStatus" AS ENUM ('NOT_CONNECTED', 'CONNECTED', 'ERROR');

CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kind" "IntegrationKind" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
    "config" JSONB,
    "connectedAt" TIMESTAMP(3),
    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Integration_orgId_kind_key" ON "Integration"("orgId", "kind");
CREATE INDEX "Integration_orgId_idx" ON "Integration"("orgId");

CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ApiKey_orgId_idx" ON "ApiKey"("orgId");

CREATE TABLE "SsoConfig" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "provider" TEXT,
    "idpMetadata" JSONB,
    "enforce" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SsoConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SsoConfig_orgId_key" ON "SsoConfig"("orgId");
CREATE INDEX "SsoConfig_orgId_idx" ON "SsoConfig"("orgId");
