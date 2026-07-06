import { auth } from "@/auth";

// AUTH.1 — the real server-side session read (replaces the ADMIN stub). Returns
// the same shape the shell/screens/dbForOrg/requireRole already consume:
// { id, orgId, role, name, email } — or null when logged out. The session's
// `orgId` is the tenant boundary (from the signed JWT, never the client); the
// passwordHash is never part of the session.
export async function getCurrentUser() {
  const session = await auth();
  const u = session?.user;
  if (!u?.id || !u.orgId) return null;
  return {
    id: u.id,
    orgId: u.orgId,
    role: u.role,
    name: u.name ?? "",
    email: u.email ?? "",
  };
}
