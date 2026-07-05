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
