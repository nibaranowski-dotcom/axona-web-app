import { prisma } from "@axona/db";

// TODO AUTH.1: replace with the real Auth.js session (orgId + user from cookie).
// Until then, the shell + screens render against the seeded demo ADMIN so we can
// build UI pre-auth. Nav is read-all; action-level RBAC is per-screen (RBAC.2/3).
export async function getCurrentUser() {
  return prisma.user.findFirst({ where: { role: "ADMIN" } });
}
