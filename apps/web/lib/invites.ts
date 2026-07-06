import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma, type Role, type InviteStatus } from "@axona/db";

// AUTH.5 — invite creation + accept core (server-only; shared by the actions + the
// verify script). Tokens are crypto-random (32 bytes, base64url), single-use, and
// expiring (7d). The invitee joins at EXACTLY the invited role — never escalated.
// One invite binds one orgId. Email delivery is EMAIL.1 — the link is returned for
// the inviter to copy for now. Never logs the token/password.

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const ROLES = [
  "ADMIN",
  "OPS",
  "ENGINEER",
  "SALES",
  "FINANCE",
  "TECH",
  "VIEWER",
] as const;

export const inviteRowSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(ROLES),
});
export type InviteRow = z.infer<typeof inviteRowSchema>;

export interface InviteResult {
  email: string;
  role: Role;
  status:
    | "created"
    | "skipped-existing-user"
    | "skipped-already-invited"
    | "invalid";
  link?: string; // ${APP_URL}/invite/:token — present when created
}

function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3001").replace(/\/+$/, "");
}

function newToken(): string {
  return randomBytes(32).toString("base64url"); // 43 chars, unguessable
}

/**
 * Create PENDING invites for a batch (org member with rights → email+role). Per-row
 * SKIP (never abort the batch) for an email that's already a User or already has a
 * PENDING invite for this org. Returns each row's status + a copyable link when
 * created. Caller must have already role-gated (ADMIN).
 */
export async function createInvites(
  orgId: string,
  rows: unknown[],
  invitedBy: { id: string; label: string },
): Promise<InviteResult[]> {
  const seen = new Set<string>();
  const out: InviteResult[] = [];

  for (const raw of rows) {
    const parsed = inviteRowSchema.safeParse(raw);
    if (!parsed.success) {
      out.push({ email: "", role: "VIEWER", status: "invalid" });
      continue;
    }
    const { email, role } = parsed.data;
    if (seen.has(email)) continue; // in-batch dedupe (silent)
    seen.add(email);

    // Already a user (globally unique email) → they have an account; skip.
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      out.push({ email, role, status: "skipped-existing-user" });
      continue;
    }
    // Already a PENDING invite for THIS org → skip (don't duplicate).
    const pending = await prisma.invite.findFirst({
      where: { orgId, email, status: "PENDING" },
    });
    if (pending) {
      out.push({ email, role, status: "skipped-already-invited" });
      continue;
    }

    const token = newToken();
    await prisma.invite.create({
      data: {
        orgId,
        email,
        role,
        token,
        invitedById: invitedBy.id,
        invitedByLabel: invitedBy.label,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });
    out.push({
      email,
      role,
      status: "created",
      link: `${appUrl()}/invite/${token}`,
    });
  }
  return out;
}

export interface PendingInvite {
  id: string;
  email: string;
  role: Role;
  invitedByLabel: string;
  createdAt: Date;
  expiresAt: Date;
}

/** PENDING invites for an org (the minimal list; SET.2 is the full members UI). */
export async function listInvites(orgId: string): Promise<PendingInvite[]> {
  return prisma.invite.findMany({
    where: { orgId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      invitedByLabel: true,
      createdAt: true,
      expiresAt: true,
    },
  });
}

/** Revoke a PENDING invite (org-scoped). Caller must have role-gated (ADMIN). */
export async function revokeInvite(
  orgId: string,
  id: string,
): Promise<boolean> {
  const res = await prisma.invite.updateMany({
    where: { id, orgId, status: "PENDING" },
    data: { status: "REVOKED" },
  });
  return res.count > 0;
}

// ── accept ──────────────────────────────────────────────────────────────────

export interface InviteView {
  token: string;
  orgId: string;
  orgName: string;
  email: string;
  role: Role;
  invitedByLabel: string;
}

type LoadInvite =
  | { ok: true; invite: InviteView }
  | { ok: false; reason: "invalid" };

/** Load a PENDING, unexpired invite for the accept screen (public, by token). */
export async function loadInvite(token: string): Promise<LoadInvite> {
  if (!token) return { ok: false, reason: "invalid" };
  const invite = await prisma.invite.findUnique({ where: { token } });
  if (
    !invite ||
    invite.status !== "PENDING" ||
    invite.expiresAt.getTime() < Date.now()
  ) {
    return { ok: false, reason: "invalid" };
  }
  const org = await prisma.org.findUnique({
    where: { id: invite.orgId },
    select: { name: true },
  });
  return {
    ok: true,
    invite: {
      token: invite.token,
      orgId: invite.orgId,
      orgName: org?.name ?? "the workspace",
      email: invite.email,
      role: invite.role,
      invitedByLabel: invite.invitedByLabel,
    },
  };
}

const acceptSchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  password: z.string().min(8),
});

export type AcceptResult =
  | { ok: true; orgId: string; userId: string; email: string; role: Role }
  | { ok: false; reason: "invalid" | "exists"; message: string };

/**
 * Accept an invite: one race-safe transaction — re-check PENDING+unexpired, reject
 * if the email is now a User, else create the User at EXACTLY invite.role (bcrypt),
 * mark the invite ACCEPTED. Never escalates the role; only ever creates a user in
 * invite.orgId.
 */
export async function acceptInvite(raw: unknown): Promise<AcceptResult> {
  const parsed = acceptSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "invalid",
      message:
        "Please enter your name and a password of at least 8 characters.",
    };
  }
  const { token, name, password } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const invite = await tx.invite.findUnique({ where: { token } });
      if (
        !invite ||
        invite.status !== "PENDING" ||
        invite.expiresAt.getTime() < Date.now()
      ) {
        return { ok: false as const, reason: "invalid" as const };
      }
      const existing = await tx.user.findUnique({
        where: { email: invite.email },
      });
      if (existing) return { ok: false as const, reason: "exists" as const };

      const user = await tx.user.create({
        data: {
          orgId: invite.orgId, // the invite's org only — no cross-org
          name,
          email: invite.email, // locked to the invited address
          role: invite.role, // EXACTLY the invited role — never escalated
          passwordHash,
        },
      });
      await tx.invite.update({
        where: { id: invite.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
      return {
        ok: true as const,
        orgId: invite.orgId,
        userId: user.id,
        email: invite.email,
        role: invite.role,
      };
    });

    if (!result.ok) {
      return result.reason === "exists"
        ? {
            ok: false,
            reason: "exists",
            message:
              "An account with this email already exists — log in instead.",
          }
        : {
            ok: false,
            reason: "invalid",
            message: "This invite is no longer valid.",
          };
    }
    return result;
  } catch {
    return {
      ok: false,
      reason: "exists",
      message: "An account with this email already exists — log in instead.",
    };
  }
}

export type { Role, InviteStatus };
