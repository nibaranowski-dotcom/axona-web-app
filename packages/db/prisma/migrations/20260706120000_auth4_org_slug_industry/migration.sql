-- AUTH.4 — workspace slug + vertical for org provisioning. slug is nullable-unique
-- (existing orgs get one from the seed; new orgs derive + auto-suffix). industry
-- is nullable. Postgres UNIQUE allows multiple NULLs.
ALTER TABLE "Org" ADD COLUMN "slug" TEXT;
ALTER TABLE "Org" ADD COLUMN "industry" TEXT;
CREATE UNIQUE INDEX "Org_slug_key" ON "Org"("slug");
