"use server";

import { revalidatePath } from "next/cache";
import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { requireRole } from "@/lib/rbac";
import { decide } from "@/lib/approvals";

// Change control (ENG.2). A DRAFT ECO is submitted to REVIEW (a low-stakes
// workflow step); the gated RELEASE decision goes through the RBAC.4/5 approval
// primitive (decide → requireRole → org-scoped → AUDIT.1), so every release +
// rejection is audited and surfaces on /audit. No ad-hoc release path remains —
// advanceEco only submits a draft to review.

export async function advanceEco(ecoId: string): Promise<void> {
  const user = await getCurrentUser();
  requireRole(user, ["ENGINEER", "ADMIN"]); // line 1 — before any DB call
  const db = dbForOrg(user.orgId);
  const eco = await db.eCO.findFirst({ where: { id: ecoId } }); // org-scoped
  if (!eco || eco.stage !== "DRAFT") throw new Error("ECO not submittable");
  await db.eCO.updateMany({ where: { id: ecoId }, data: { stage: "REVIEW" } });
  revalidatePath("/engineering");
}

// RBAC.5 — the gated ECO release, exclusively through the approval primitive.
export async function approveEcoRelease(ecoId: string): Promise<void> {
  const user = await getCurrentUser();
  await decide("eco.release", ecoId, "APPROVE", user); // role-gates + audits
  revalidatePath("/engineering");
}

export async function rejectEcoRelease(ecoId: string): Promise<void> {
  const user = await getCurrentUser();
  await decide("eco.release", ecoId, "REJECT", user);
  revalidatePath("/engineering");
}
