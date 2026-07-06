-- SET.3 — profile avatar + stateless-JWT revoke (tokenVersion) + login sessions.
ALTER TABLE "User" ADD COLUMN "avatarKey" TEXT;
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "LoginSession" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "ip" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoginSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LoginSession_orgId_idx" ON "LoginSession"("orgId");
CREATE INDEX "LoginSession_userId_idx" ON "LoginSession"("userId");
