"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { decide } from "@/lib/approvals";

// The human half of "AI proposes, human approves" (PROC.2). A drafted PO is
// advanced / rejected by a person only — the agent never auto-sends. Both paths go
// exclusively through the RBAC.4 approval primitive (decide): requireRole →
// org-scoped load → transition → AUDIT.1 entry. No ad-hoc mutation remains here.

export async function advancePurchaseOrder(poId: string): Promise<void> {
  const user = await getCurrentUser();
  await decide("po.approve", poId, "APPROVE", user); // decide role-gates + audits
  revalidatePath("/procurement");
}

export async function rejectPurchaseOrder(poId: string): Promise<void> {
  const user = await getCurrentUser();
  await decide("po.approve", poId, "REJECT", user);
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
