-- NOTIF.1 — in-app notifications (user-targeted or org/role broadcast).
CREATE TYPE "NotificationType" AS ENUM ('APPROVAL', 'EXCEPTION', 'RUN', 'MENTION', 'SYSTEM');

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Notification_orgId_userId_createdAt_idx" ON "Notification"("orgId", "userId", "createdAt");
