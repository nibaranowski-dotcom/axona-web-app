-- BILL.3 — Axona-as-SaaS subscription + SaaS invoices (Stripe deferred; no charges).
CREATE TYPE "PlanTier" AS ENUM ('PILOT', 'SCALE', 'ENTERPRISE');
CREATE TYPE "SubStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');
CREATE TYPE "InvoiceSaaSStatus" AS ENUM ('PAID', 'OPEN', 'VOID');

CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "plan" "PlanTier" NOT NULL DEFAULT 'PILOT',
    "status" "SubStatus" NOT NULL DEFAULT 'TRIALING',
    "seatsPurchased" INTEGER NOT NULL DEFAULT 10,
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "paymentSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Subscription_orgId_key" ON "Subscription"("orgId");
CREATE INDEX "Subscription_orgId_idx" ON "Subscription"("orgId");

CREATE TABLE "InvoiceSaaS" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "InvoiceSaaSStatus" NOT NULL DEFAULT 'PAID',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "url" TEXT,
    CONSTRAINT "InvoiceSaaS_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InvoiceSaaS_orgId_idx" ON "InvoiceSaaS"("orgId");
