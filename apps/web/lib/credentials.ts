import bcrypt from "bcryptjs";
import { prisma, type Role } from "@axona/db";

// AUTH.1 — the credential check, extracted so the Auth.js `authorize()` and the
// verify script share ONE implementation. Verifies the password against
// User.passwordHash with bcryptjs; returns the session-safe user (never the hash)
// or null (unknown email / SSO-only user / wrong password).
export interface SessionUser {
  id: string;
  orgId: string;
  role: Role;
  name: string;
  email: string;
}

export async function verifyCredentials(
  emailInput: unknown,
  passwordInput: unknown,
): Promise<SessionUser | null> {
  const email = String(emailInput ?? "")
    .toLowerCase()
    .trim();
  const password = String(passwordInput ?? "");
  if (!email || !password) return null;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash) return null;

  // SET.2 — a deactivated member can't authenticate (no active seat).
  if (user.deactivatedAt) return null;

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;

  // SET.2 — stamp last-seen on a successful login (powers the "last active" column).
  await prisma.user.update({
    where: { id: user.id },
    data: { lastSeenAt: new Date() },
  });

  return {
    id: user.id,
    orgId: user.orgId,
    role: user.role,
    name: user.name,
    email: user.email,
  };
}
