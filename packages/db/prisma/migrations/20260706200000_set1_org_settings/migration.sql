-- SET.1 — org branding/config. logoKey (FILE.1 blob key; upload UI deferred),
-- timezone (IANA), fiscalYearStartMonth (1-12), defaultMemberRole (prefills invites).
ALTER TABLE "Org" ADD COLUMN "logoKey" TEXT;
ALTER TABLE "Org" ADD COLUMN "timezone" TEXT;
ALTER TABLE "Org" ADD COLUMN "fiscalYearStartMonth" INTEGER;
ALTER TABLE "Org" ADD COLUMN "defaultMemberRole" "Role";
