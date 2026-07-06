import { auth } from "@/auth";
import { prisma } from "@axona/db";

// AUTH.1 — the real server-side session read (replaces the ADMIN stub). Returns
// the same shape the shell/screens/dbForOrg/requireRole already consume:
// { id, orgId, role, name, email } — or null when logged out. The session's
// `orgId` is the tenant boundary (from the signed JWT, never the client); the
// passwordHash is never part of the session.
//
// SET.3 — stateless-JWT revoke is enforced HERE (the Node session-read boundary
// every screen/action calls) rather than the edge-safe session callback, because
// the check needs a DB read: a token whose tokenVersion ≠ User.tokenVersion (a
// password change or "sign out everywhere" bumped it) is treated as logged out.
export async function getCurrentUser() {
  const session = await auth();
  const u = session?.user;
  if (!u?.id || !u.orgId) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: u.id },
    select: { tokenVersion: true, deactivatedAt: true },
  });
  // Unknown / deactivated / stale-version token → treat as unauthenticated.
  if (
    !dbUser ||
    dbUser.deactivatedAt ||
    dbUser.tokenVersion !== (u.tokenVersion ?? 0)
  ) {
    return null;
  }

  return {
    id: u.id,
    orgId: u.orgId,
    role: u.role,
    name: u.name ?? "",
    email: u.email ?? "",
  };
}
