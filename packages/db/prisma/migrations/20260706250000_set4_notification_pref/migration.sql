-- SET.4 — per-user notification preferences (event x channel matrix + mute + quiet).
CREATE TABLE "NotificationPref" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "prefs" JSONB NOT NULL,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "quietStart" TEXT,
    "quietEnd" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationPref_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationPref_userId_key" ON "NotificationPref"("userId");
CREATE INDEX "NotificationPref_orgId_idx" ON "NotificationPref"("orgId");
