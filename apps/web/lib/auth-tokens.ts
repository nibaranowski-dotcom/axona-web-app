import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@axona/db";
import { sendEmail } from "./email/send";

// AUTH.7 — password reset + email verification token flows (server-only). Tokens
// are crypto-random, single-use, short-lived (reset 1h, verify 24h). A completed
// reset bumps User.tokenVersion (invalidates existing sessions). Request-reset is
// anti-enumeration: it ALWAYS returns the same confirmation, token or not.

const RESET_TTL_MS = 60 * 60 * 1000; // 1h
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3001").replace(/\/+$/, "");
}
function newToken(): string {
  return randomBytes(32).toString("base64url");
}

// ── password reset ───────────────────────────────────────────────────────────

/**
 * Request a reset. If a user exists for the email, create a single-use 1h token +
 * send the reset email. ALWAYS returns void (the caller shows the same "check your
 * inbox" confirmation regardless) — anti-enumeration.
 */
export async function requestPasswordReset(emailInput: string): Promise<void> {
  const email = emailInput.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.deactivatedAt) return; // silent — don't reveal existence
  const token = newToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    },
  });
  await sendEmail(
    { kind: "reset", props: { resetUrl: `${appUrl()}/reset/${token}` } },
    email,
  );
}

export interface ResetTokenView {
  ok: boolean;
  email?: string;
}

export async function loadResetToken(token: string): Promise<ResetTokenView> {
  if (!token) return { ok: false };
  const row = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now())
    return { ok: false };
  const user = await prisma.user.findUnique({
    where: { id: row.userId },
    select: { email: true },
  });
  return { ok: true, email: user?.email };
}

export type ResetResult =
  | { ok: true; email: string }
  | { ok: false; message: string };

/**
 * Complete a reset: validate (unused, unexpired), re-hash, mark the token used, and
 * BUMP tokenVersion (old sessions invalid). Race-safe in one transaction.
 */
export async function completePasswordReset(
  token: string,
  nextPassword: string,
): Promise<ResetResult> {
  if (!nextPassword || nextPassword.length < 8) {
    return { ok: false, message: "Use at least 8 characters." };
  }
  const passwordHash = await bcrypt.hash(nextPassword, 10);
  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.passwordResetToken.findUnique({ where: { token } });
      if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
        return {
          ok: false as const,
          message: "This reset link is no longer valid.",
        };
      }
      const user = await tx.user.update({
        where: { id: row.userId },
        data: { passwordHash, tokenVersion: { increment: 1 } }, // invalidate sessions
        select: { email: true },
      });
      await tx.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      });
      return { ok: true as const, email: user.email };
    });
  } catch {
    return { ok: false, message: "This reset link is no longer valid." };
  }
}

// ── email verification ─────────────────────────────────────────────────────────

/** Create a verify token + send the verify email (called on signup). */
export async function sendVerificationEmail(
  userId: string,
  email: string,
): Promise<void> {
  const token = newToken();
  await prisma.emailVerifyToken.create({
    data: { userId, token, expiresAt: new Date(Date.now() + VERIFY_TTL_MS) },
  });
  await sendEmail(
    { kind: "verify", props: { verifyUrl: `${appUrl()}/verify/${token}` } },
    email,
  );
}

export type VerifyResult = { ok: boolean };

/** Consume a verify token → set User.emailVerifiedAt, mark used. Single-use. */
export async function verifyEmailToken(token: string): Promise<VerifyResult> {
  if (!token) return { ok: false };
  const row = await prisma.emailVerifyToken.findUnique({ where: { token } });
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now())
    return { ok: false };
  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.emailVerifyToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
  ]);
  return { ok: true };
}
