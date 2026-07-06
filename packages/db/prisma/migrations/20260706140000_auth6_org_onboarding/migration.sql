-- AUTH.6 — onboarding-completion flag (routing) + per-org module enablement.
-- onboardedAt is null until the wizard finishes; enabledModules defaults to an
-- empty array which the app treats as ALL (back-compat for demo/pre-existing orgs).
ALTER TABLE "Org" ADD COLUMN "onboardedAt" TIMESTAMP(3);
ALTER TABLE "Org" ADD COLUMN "enabledModules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
