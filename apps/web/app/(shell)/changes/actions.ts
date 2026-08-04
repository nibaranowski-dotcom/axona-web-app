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

/**
 * DEMO.6 #5 — recover the agent proposal this release decides ON, so decide() stamps
 * its model + confidence onto the AUDIT.1 entry (the DecideContext seam). Read from
 * the agent's own entry in the immutable log, never a literal here. Returns undefined
 * for a human-raised ECO, which correctly leaves those fields null.
 *
 * NOT dual sign-off. Real dual sign-off (proposer != approver, like the baseline lock)
 * needs proposer/approver columns on ECO, a two-step state machine and updates to the
 * six verifies that assert eco.release today — a story, not a surfacing change. This
 * closes the AUDIT half of that beat only.
 */
async function ecoProposal(
  orgId: string,
  code: string,
): Promise<{ model: string; confidence: number } | undefined> {
  const { dbForOrg, getCalibrationModel, calibratedConfidence } =
    await import("@axona/db");
  const db = dbForOrg(orgId);
  const draft = await db.auditLog.findFirst({
    where: { actorType: "AGENT", targetType: "ECO", targetId: code },
    orderBy: { createdAt: "asc" },
    select: { model: true, confidence: true },
  });
  if (!draft?.model || draft.confidence == null) return undefined;
  const cal = calibratedConfidence(
    draft.confidence,
    await getCalibrationModel(orgId),
  );
  return { model: draft.model, confidence: Math.round(cal.value * 100) / 100 };
}

export async function approveChangeOrder(code: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in to decide.");
  const id = await ecoIdByCode(user.orgId, code);
  if (!id) throw new Error(`Change order ${code} not found.`);
  const proposal = await ecoProposal(user.orgId, code);
  await decide("eco.release", id, "APPROVE", user, { proposal }); // role-gates + audits
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
