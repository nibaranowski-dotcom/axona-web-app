"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { decide } from "@/lib/approvals";

// Autonomy policy rollback (AUTO.2), RBAC.5. A regressed policy version is rolled
// back to standby ONLY by a person via the shared approval primitive (decide →
// requireRole TECH/ADMIN → org-scoped → AUDIT.1), so the decision is audited and
// surfaces on /audit with the approver. No ad-hoc mutation remains here.
// /// policy.promote (roll a healthy canary forward to current) is a future gated
// kind — deferred; RBAC.5 wires the rollback approval registered in approvals.ts.

export async function approvePolicyRollback(policyId: string): Promise<void> {
  const user = await getCurrentUser();
  await decide("policy.rollback", policyId, "APPROVE", user); // role-gates + audits
  revalidatePath("/autonomy");
}

export async function rejectPolicyRollback(policyId: string): Promise<void> {
  const user = await getCurrentUser();
  await decide("policy.rollback", policyId, "REJECT", user);
  revalidatePath("/autonomy");
}
