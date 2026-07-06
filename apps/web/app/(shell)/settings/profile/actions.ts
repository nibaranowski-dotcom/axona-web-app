"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { dbForOrg, prisma } from "@axona/db";
import { writeAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/session";
import { signOut } from "@/auth";

// SET.3 — profile & security actions. OWN-USER ONLY (never another user — that's
// SET.2): every mutation targets the session user's own id, org-scoped, audited.
// changePassword verifies the current password and bumps tokenVersion (invalidates
// other stateless-JWT sessions). Passwords are bcrypt-hashed, never logged.

export interface ProfileActionResult {
  ok: boolean;
  message?: string;
}

function actor(user: { id: string; name: string; email: string }) {
  return { id: user.id, label: user.name || user.email };
}

const profileSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120),
});

// updateProfile — own name (avatar deferred). Audit user.profile_change.
export async function updateProfile(input: {
  name: string;
}): Promise<ProfileActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Not signed in." };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid.",
    };
  }
  const db = dbForOrg(user.orgId);
  await db.user.updateMany({
    where: { id: user.id }, // own user only
    data: { name: parsed.data.name },
  });
  await writeAudit(db, {
    orgId: user.orgId,
    actor: { type: "HUMAN", id: user.id, label: actor(user).label },
    action: "user.profile_change",
    target: { type: "User", id: user.id },
    summary: `Updated their profile`,
    approver: actor(user),
  });
  revalidatePath("/settings/profile");
  return { ok: true };
}

const passwordSchema = z.object({
  current: z.string().min(1),
  next: z.string().min(8, "Use at least 8 characters."),
});

// changePassword — verify current, set new, bump tokenVersion. Audit (never log pw).
export async function changePassword(input: {
  current: string;
  next: string;
}): Promise<ProfileActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Not signed in." };
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid.",
    };
  }
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!dbUser?.passwordHash) {
    return { ok: false, message: "No password set for this account." };
  }
  const ok = await bcrypt.compare(parsed.data.current, dbUser.passwordHash);
  if (!ok) {
    return { ok: false, message: "Your current password is incorrect." };
  }
  const passwordHash = await bcrypt.hash(parsed.data.next, 10);
  const db = dbForOrg(user.orgId);
  await db.user.updateMany({
    where: { id: user.id },
    data: { passwordHash, tokenVersion: { increment: 1 } }, // invalidate other sessions
  });
  await writeAudit(db, {
    orgId: user.orgId,
    actor: { type: "HUMAN", id: user.id, label: actor(user).label },
    action: "user.password_change",
    target: { type: "User", id: user.id },
    summary: `Changed their password`,
    approver: actor(user),
  });
  revalidatePath("/settings/profile");
  return { ok: true };
}

// signOutEverywhere — bump tokenVersion (all existing tokens invalid) + sign out.
export async function signOutEverywhere(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const db = dbForOrg(user!.orgId);
  await db.user.updateMany({
    where: { id: user!.id },
    data: { tokenVersion: { increment: 1 } },
  });
  await db.loginSession.deleteMany({ where: { userId: user!.id } });
  await writeAudit(db, {
    orgId: user!.orgId,
    actor: { type: "HUMAN", id: user!.id, label: actor(user!).label },
    action: "user.signout_all",
    target: { type: "User", id: user!.id },
    summary: `Signed out of all devices`,
    approver: actor(user!),
  });
  await signOut({ redirectTo: "/login" });
}

// revokeSession — best-effort remove one LoginSession row (own user only). Full
// JWT revoke needs sign-out-everywhere (flagged in the UI).
export async function revokeSession(id: string): Promise<ProfileActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Not signed in." };
  const db = dbForOrg(user.orgId);
  await db.loginSession.deleteMany({ where: { id, userId: user.id } }); // own only
  revalidatePath("/settings/profile");
  return { ok: true };
}
