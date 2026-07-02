"use server";

import { revalidatePath } from "next/cache";
import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { requireRole } from "@/lib/rbac";

// The human half of change control (ENG.2). An ECO is advanced through the stage
// board by a person only — RELEASE is the human-approved gated step (the agent
// drafts/proposes, a human releases). Role-gated + org-scoped. The full release
// approval state machine + gates are RBAC.4; the immutable event log is AUDIT.3
// (seam left below). Same pattern as PROC.2's advancePurchaseOrder.

const NEXT: Record<string, string> = {
  DRAFT: "REVIEW",
  REVIEW: "APPROVED",
  APPROVED: "RELEASED",
};

export async function advanceEco(ecoId: string): Promise<void> {
  const user = await getCurrentUser();
  requireRole(user, ["ENGINEER", "ADMIN"]); // line 1 — before any DB call

  const db = dbForOrg(user.orgId);
  const eco = await db.eCO.findFirst({ where: { id: ecoId } }); // org-scoped
  const to = eco ? NEXT[eco.stage] : undefined;
  if (!eco || !to) throw new Error("ECO not advanceable");

  await db.eCO.updateMany({ where: { id: ecoId }, data: { stage: to } });

  // The transition, attributed to the acting user (the trace line for now).
  console.info(
    `[engineering] ECO ${eco.code} ${eco.stage} → ${to} by ${user.email} (${user.role})`,
  );
  // /// TODO AUDIT.3: append an immutable event-log row
  //   { ecoId, from: eco.stage, to, actor: user.id, model: null, ts }.
  //   RBAC.4 formalizes the release approval state machine + gates.

  revalidatePath("/engineering");
}
