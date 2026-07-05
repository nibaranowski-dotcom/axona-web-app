"use server";

import { revalidatePath } from "next/cache";
import { dbForOrg, type POStatus } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { requireRole } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

// The human half of "AI proposes, human approves" (PROC.2). A drafted PO is
// advanced by a person only — the agent never auto-sends. Role-gated + org-scoped.
// Every advance appends an immutable audit row (AUDIT.1); the full approval state
// machine + gates are RBAC.4, and AUDIT.3 enriches the entry (model/confidence/approver).

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

  // AUDIT.1 — append the immutable event-log row (best-effort; never rolls back
  // the advance). AUDIT.3 will enrich with model/confidence/approver; RBAC.4 adds
  // the full approval state machine.
  await writeAudit(db, {
    orgId: user.orgId,
    actor: { type: "HUMAN", id: user.id, label: user.email },
    action: "po.advance",
    target: { type: "PurchaseOrder", id: po.id },
    summary: `PO ${po.code} ${po.status} → ${to}`,
    inputs: { from: po.status },
    output: { status: to },
  });

  revalidatePath("/procurement");
}
