-- SET.2 — member deactivation + last-seen. deactivatedAt set = can't log in;
-- lastSeenAt is stamped on each successful login (powers the "last active" column).
ALTER TABLE "User" ADD COLUMN "deactivatedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
