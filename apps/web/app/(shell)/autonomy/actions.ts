"use server";

import { revalidatePath } from "next/cache";
import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { requireRole } from "@/lib/rbac";

// The human half of policy rollout (AUTO.2). A canary policy is promoted to
// current (roll forward) or sent to standby (roll back) by a person only — the
// agent proposes, a human decides. Role-gated + org-scoped. The full promotion/
// rollback state machine + the sim-validate-before-promote gate are RBAC.4; the
// immutable event log is AUDIT.3 (seam left below). Same pattern as PROC.2/ENG.2.

export async function advancePolicy(
  policyId: string,
  action: "promote" | "rollback",
): Promise<void> {
  const user = await getCurrentUser();
  requireRole(user, ["ENGINEER", "ADMIN"]); // line 1 — before any DB call

  const db = dbForOrg(user.orgId);
  const policy = await db.policyVersion.findFirst({ where: { id: policyId } }); // org-scoped
  if (!policy || policy.state.toLowerCase() !== "canary") {
    throw new Error("only a canary policy can be promoted or rolled back");
  }
  const to = action === "promote" ? "current" : "standby";

  await db.policyVersion.updateMany({
    where: { id: policyId },
    data: { state: to },
  });

  console.info(
    `[autonomy] policy ${policy.version} canary → ${to} (${action}) by ${user.email} (${user.role})`,
  );
  // /// TODO AUDIT.3: append an immutable event-log row
  //   { policyId, from: policy.state, to, actor: user.id, model: null, ts }.
  //   RBAC.4 formalizes the promotion/rollback state machine; the
  //   sim-validate-before-promote gate is deferred.

  revalidatePath("/autonomy");
}
