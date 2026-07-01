"use server";

import { revalidatePath } from "next/cache";
import { dbForOrg, type POStatus } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { requireRole } from "@/lib/rbac";

// The human half of "AI proposes, human approves" (PROC.2). A drafted PO is
// advanced by a person only — the agent never auto-sends. Role-gated + org-scoped.
// The full approval state machine + gates are RBAC.4; the immutable event log is
// AUDIT.3 (seam left below).

const NEXT: Record<string, POStatus> = {
  DRAFTED: "AWAITING_APPROVAL",
  AWAITING_APPROVAL: "APPROVED",
  APPROVED: "SENT",
};

export async function advancePurchaseOrder(poId: string): Promise<void> {
  const user = await getCurrentUser();
  requireRole(user, ["OPS", "ADMIN"]); // line 1 — before any DB call

  const db = dbForOrg(user.orgId);
  const po = await db.purchaseOrder.findFirst({ where: { id: poId } }); // org-scoped
  const to = po ? NEXT[po.status] : undefined;
  if (!po || !to) throw new Error("purchase order not advanceable");

  await db.purchaseOrder.updateMany({
    where: { id: poId },
    data: { status: to },
  });

  // The transition, attributed to the acting user (the trace line for now).
  console.info(
    `[procurement] PO ${po.code} ${po.status} → ${to} by ${user.email} (${user.role})`,
  );
  // /// TODO AUDIT.3: append an immutable event-log row
  //   { poId, from: po.status, to, actor: user.id, model: null, ts }.
  //   RBAC.4 formalizes the full approval state machine + gates.

  revalidatePath("/procurement");
}
