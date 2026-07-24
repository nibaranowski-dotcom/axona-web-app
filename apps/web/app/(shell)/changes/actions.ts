"use server";

import { revalidatePath } from "next/cache";
import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { decide } from "@/lib/approvals";

// PLM.9 — the gated change-order decision. Review/approve routes EXCLUSIVELY
// through the RBAC.4/5 approval primitive (decide("eco.release") → requireRole →
// org-scoped load + pending check + effect + AUDIT.1). No ad-hoc release path.
// Keyed by ECO code (the route param) → resolve to the id decide() expects.

async function ecoIdByCode(
  orgId: string,
  code: string,
): Promise<string | null> {
  const eco = await dbForOrg(orgId).eCO.findFirst({
    where: { code },
    select: { id: true },
  });
  return eco?.id ?? null;
}

export async function approveChangeOrder(code: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in to decide.");
  const id = await ecoIdByCode(user.orgId, code);
  if (!id) throw new Error(`Change order ${code} not found.`);
  await decide("eco.release", id, "APPROVE", user); // role-gates + audits
  revalidatePath(`/changes/${code}`);
}

export async function requestChangesOnOrder(code: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in to decide.");
  const id = await ecoIdByCode(user.orgId, code);
  if (!id) throw new Error(`Change order ${code} not found.`);
  await decide("eco.release", id, "REJECT", user); // role-gates + audits
  revalidatePath(`/changes/${code}`);
}
