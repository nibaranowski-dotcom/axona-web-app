"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { decide } from "@/lib/approvals";

// The human half of "AI proposes, human approves" (PROC.2). A drafted PO is
// advanced / rejected by a person only — the agent never auto-sends. Both paths go
// exclusively through the RBAC.4 approval primitive (decide): requireRole →
// org-scoped load → transition → AUDIT.1 entry. No ad-hoc mutation remains here.

/**
 * DEMO.6 #10 — recover the agent proposal this decision is ON, so `decide()` can
 * stamp its model + confidence onto the AUDIT.1 entry (the DecideContext seam beat
 * #4 added). The values come from the agent's own `po.draft` entry in the immutable
 * log — the confidence it actually stated when it drafted — never a literal here.
 * Returns undefined for a human-raised PO, which correctly leaves those fields null.
 */
async function proposalFor(
  orgId: string,
  poId: string,
): Promise<{ model: string; confidence: number } | undefined> {
  const { dbForOrg, getCalibrationModel, calibratedConfidence } =
    await import("@axona/db");
  const db = dbForOrg(orgId);
  const po = await db.purchaseOrder.findFirst({
    where: { id: poId },
    select: { code: true, draftedByAgentId: true },
  });
  if (!po?.draftedByAgentId) return undefined;
  const draft = await db.auditLog.findFirst({
    where: {
      actorType: "AGENT",
      targetType: "PurchaseOrder",
      targetId: po.code,
    },
    orderBy: { createdAt: "asc" },
    select: { model: true, confidence: true },
  });
  if (!draft?.model || draft.confidence == null) return undefined;
  // CONF.1 — record the CALIBRATED value, the same number the screen showed.
  const cal = calibratedConfidence(
    draft.confidence,
    await getCalibrationModel(orgId),
  );
  return { model: draft.model, confidence: Math.round(cal.value * 100) / 100 };
}

export async function advancePurchaseOrder(poId: string): Promise<void> {
  const user = await getCurrentUser();
  const proposal = user ? await proposalFor(user.orgId, poId) : undefined;
  // decide role-gates + audits; the proposal context adds model + confidence.
  await decide("po.approve", poId, "APPROVE", user, { proposal });
  revalidatePath("/procurement");
}

export async function rejectPurchaseOrder(poId: string): Promise<void> {
  const user = await getCurrentUser();
  const proposal = user ? await proposalFor(user.orgId, poId) : undefined;
  await decide("po.approve", poId, "REJECT", user, { proposal });
  revalidatePath("/procurement");
}

// BR.1 — goods receipt (the dock scan). A SENT PO is received: SENT → RECEIVED +
// stock bump, through the same gated decide() (OPS/ADMIN, audited). Revalidate the
// queue AND every unit page so the Build-readiness card ticks up live when the
// received part covers a BOM line.
export async function receivePurchaseOrder(poId: string): Promise<void> {
  const user = await getCurrentUser();
  await decide("po.receive", poId, "APPROVE", user);
  revalidatePath("/procurement");
  revalidatePath("/units/[serial]", "page");
}
