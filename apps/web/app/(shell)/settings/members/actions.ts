"use server";

import { revalidatePath } from "next/cache";
import { dbForOrg, type Role } from "@axona/db";
import { writeAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/session";
import { requireRole } from "@/lib/rbac";
import {
  createInvites,
  revokeInvite as revokeInviteCore,
  type InviteResult,
} from "@/lib/invites";

// SET.2 — member-management actions. EVERY action: requireRole(["ADMIN"]) on line
// 1, mutates via dbForOrg(user.orgId) (org isolation), and writes an AUDIT.1 entry
// on success (actor = the ADMIN, target = the member). Guards: cannot remove/
// deactivate the last ADMIN; cannot deactivate yourself; deactivated users can't
// log in (enforced in verifyCredentials).

const VALID_ROLES: Role[] = [
  "ADMIN",
  "OPS",
  "ENGINEER",
  "SALES",
  "FINANCE",
  "TECH",
  "VIEWER",
];

export interface MembersActionResult {
  ok: boolean;
  message?: string;
  invites?: InviteResult[];
}

function actor(user: { id: string; name: string; email: string }) {
  return { id: user.id, label: user.name || user.email };
}

// invite — reuse AUTH.5 createInvites; audit member.invite (per created row).
export async function inviteMembers(
  rows: { email: string; role: string }[],
): Promise<MembersActionResult> {
  const user = await getCurrentUser();
  requireRole(user, ["ADMIN"]);
  const db = dbForOrg(user!.orgId);
  const results = await createInvites(user!.orgId, rows, actor(user!));
  for (const r of results.filter((x) => x.status === "created")) {
    await writeAudit(db, {
      orgId: user!.orgId,
      actor: { type: "HUMAN", id: user!.id, label: actor(user!).label },
      action: "member.invite",
      target: { type: "Invite", id: r.email },
      summary: `Invited ${r.email} as ${r.role}`,
      approver: actor(user!),
    });
  }
  revalidatePath("/settings/members");
  return { ok: true, invites: results };
}

// changeRole — guard: cannot demote the last ADMIN. Audit member.role_change.
export async function changeRole(
  userId: string,
  newRole: string,
): Promise<MembersActionResult> {
  const user = await getCurrentUser();
  requireRole(user, ["ADMIN"]);
  if (!VALID_ROLES.includes(newRole as Role)) {
    return { ok: false, message: "Invalid role." };
  }
  const db = dbForOrg(user!.orgId);
  const target = await db.user.findFirst({ where: { id: userId } });
  if (!target) return { ok: false, message: "Member not found." };
  if (target.role === newRole) return { ok: true };

  // last-ADMIN guard: demoting the only active ADMIN is rejected.
  if (target.role === "ADMIN" && newRole !== "ADMIN") {
    const admins = await db.user.count({
      where: { role: "ADMIN", deactivatedAt: null },
    });
    if (admins <= 1) {
      return {
        ok: false,
        message: "This is the last admin — assign another admin first.",
      };
    }
  }

  await db.user.updateMany({
    where: { id: userId },
    data: { role: newRole as Role },
  });
  await writeAudit(db, {
    orgId: user!.orgId,
    actor: { type: "HUMAN", id: user!.id, label: actor(user!).label },
    action: "member.role_change",
    target: { type: "User", id: userId },
    summary: `Changed ${target.name} from ${target.role} to ${newRole}`,
    output: { from: target.role, to: newRole },
    approver: actor(user!),
  });
  revalidatePath("/settings/members");
  return { ok: true };
}

// setActive — deactivate/reactivate. Guards: not the last ADMIN, not yourself.
export async function setActive(
  userId: string,
  active: boolean,
): Promise<MembersActionResult> {
  const user = await getCurrentUser();
  requireRole(user, ["ADMIN"]);
  const db = dbForOrg(user!.orgId);
  const target = await db.user.findFirst({ where: { id: userId } });
  if (!target) return { ok: false, message: "Member not found." };

  if (!active) {
    if (userId === user!.id) {
      return { ok: false, message: "You can’t deactivate yourself." };
    }
    if (target.role === "ADMIN") {
      const admins = await db.user.count({
        where: { role: "ADMIN", deactivatedAt: null },
      });
      if (admins <= 1) {
        return {
          ok: false,
          message: "This is the last admin — assign another admin first.",
        };
      }
    }
  }

  await db.user.updateMany({
    where: { id: userId },
    data: { deactivatedAt: active ? null : new Date() },
  });
  await writeAudit(db, {
    orgId: user!.orgId,
    actor: { type: "HUMAN", id: user!.id, label: actor(user!).label },
    action: active ? "member.reactivate" : "member.deactivate",
    target: { type: "User", id: userId },
    summary: `${active ? "Reactivated" : "Deactivated"} ${target.name}`,
    approver: actor(user!),
  });
  revalidatePath("/settings/members");
  return { ok: true };
}

// revokeInvite — reuse AUTH.5 revokeInvite; audit member.invite_revoke.
export async function revokeInvite(
  inviteId: string,
): Promise<MembersActionResult> {
  const user = await getCurrentUser();
  requireRole(user, ["ADMIN"]);
  const db = dbForOrg(user!.orgId);
  // Invite isn't a tenant-scoped model — scope by orgId explicitly (isolation).
  const target = await db.invite.findFirst({
    where: { id: inviteId, orgId: user!.orgId },
  });
  const revoked = await revokeInviteCore(user!.orgId, inviteId);
  if (revoked && target) {
    await writeAudit(db, {
      orgId: user!.orgId,
      actor: { type: "HUMAN", id: user!.id, label: actor(user!).label },
      action: "member.invite_revoke",
      target: { type: "Invite", id: inviteId },
      summary: `Revoked invite for ${target.email}`,
      approver: actor(user!),
    });
  }
  revalidatePath("/settings/members");
  return { ok: revoked };
}
