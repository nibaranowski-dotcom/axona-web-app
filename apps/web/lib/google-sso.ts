import { prisma } from "@axona/db";
import type { SessionUser } from "./credentials";

// AUTH.SSO — the Google sign-in link check, extracted (like verifyCredentials) so
// the Auth.js `signIn` callback and the verify script share ONE implementation.
//
// THE SECURITY RULE — link, never self-provision. On a Google sign-in we match the
// Google-VERIFIED email to an EXISTING User and issue THAT user's session (their
// orgId/role/tokenVersion — the same session-safe shape verifyCredentials returns).
// A Google email with no matching user is DENIED — we NEVER auto-create a User or
// Org (Axona is invite-based / sales-led; SSO is an alternative sign-in, not signup).
// email_verified is required. SSO grants no authz a password login wouldn't — it
// resolves the identical claims + records a LoginSession exactly like credentials.

export type GoogleLinkResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: "unverified" | "no-account" | "deactivated" };

export interface GoogleProfileInput {
  email?: unknown;
  /** Google's `email_verified` — must be true before we link. */
  emailVerified?: unknown;
}

export async function linkGoogleUser(
  profile: GoogleProfileInput,
  ctx?: { device?: string; ip?: string },
): Promise<GoogleLinkResult> {
  const email = String(profile.email ?? "")
    .toLowerCase()
    .trim();
  // SECURITY: only a Google-VERIFIED email may link to an account.
  if (profile.emailVerified !== true)
    return { ok: false, reason: "unverified" };
  if (!email) return { ok: false, reason: "no-account" };

  // LINK, never self-provision: match an EXISTING user (email is globally unique,
  // so this resolves exactly one user/org — no cross-org ambiguity). No match ⇒
  // deny; do NOT create a User or Org.
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { ok: false, reason: "no-account" };
  // SET.2 — a deactivated member can't authenticate, by any method.
  if (user.deactivatedAt) return { ok: false, reason: "deactivated" };

  // Same side effects as a credentials login (SET.2 last-seen + SET.3 session) — no
  // parallel session path. A password is NOT required (an SSO-only user has none).
  await prisma.user.update({
    where: { id: user.id },
    data: { lastSeenAt: new Date() },
  });
  await prisma.loginSession.create({
    data: {
      orgId: user.orgId,
      userId: user.id,
      device: ctx?.device?.slice(0, 200) || "Google SSO",
      ip: ctx?.ip?.slice(0, 64) || null,
    },
  });

  // The IDENTICAL session-safe shape verifyCredentials returns (no privilege change
  // via login method); the jwt callback issues the same claims from this.
  return {
    ok: true,
    user: {
      id: user.id,
      orgId: user.orgId,
      role: user.role,
      name: user.name,
      email: user.email,
      tokenVersion: user.tokenVersion,
    },
  };
}
