-- AUTH.1 — the bcrypt password hash for the Credentials provider. Nullable
-- (SSO-only users won't have one). Never returned to the client / logged.
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
