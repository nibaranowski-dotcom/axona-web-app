"use server";

import { getCurrentUser } from "@/lib/session";
import { requireRole } from "@/lib/rbac";
import { createInvites, revokeInvite, type InviteResult } from "@/lib/invites";

// AUTH.5 — invite server actions. Role-gated (ADMIN) + org-scoped to the acting
// user's own org (invites bind that orgId only). Returns per-row results with a
// copyable link (email delivery is EMAIL.1). Wired into AUTH.6's team step.
export async function createInvitesAction(
  rows: { email: string; role: string }[],
): Promise<InviteResult[]> {
  const user = await getCurrentUser();
  requireRole(user, ["ADMIN"]); // line 1 — before any DB call
  const label = user!.name || user!.email;
  return createInvites(user!.orgId, rows, { id: user!.id, label });
}

export async function revokeInviteAction(id: string): Promise<boolean> {
  const user = await getCurrentUser();
  requireRole(user, ["ADMIN"]);
  return revokeInvite(user!.orgId, id);
}
