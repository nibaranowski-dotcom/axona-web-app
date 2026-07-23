"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { requireRole } from "@/lib/rbac";
import { notify } from "@/lib/notifications";
import { handOffToFieldService } from "@/lib/field-handoff";

// PLM.5 — the field-service hand-off. Dispatching field work is a real,
// consequential write, so it is role-gated on line 1 and audited with exactly
// what it did. The effect itself lives in lib/field-handoff so verify can
// exercise the real write path.
//
// Note on decide(): the RBAC.4 approval primitive gates decisions on a PENDING
// target (a drafted PO, an ECO awaiting release). A hand-off has no pending
// proposal to approve — a human is the actor, not the approver of an agent's
// proposal. So this follows the same bar as PLM.2's import (requireRole line 1 +
// org-scoped + AUDIT.1) rather than pretending to be an approval. When an agent
// PROPOSES a hand-off (a later story), that proposal becomes the decide() target.

export async function handToFieldServiceAction(
  serials: string[],
  traceRoot: string,
): Promise<number> {
  const user = await getCurrentUser();
  requireRole(user, ["OPS", "ADMIN", "ENGINEER"]); // line 1 — before any DB call

  if (!Array.isArray(serials) || serials.length === 0) {
    throw new Error("Nothing to hand off — no affected units.");
  }
  if (serials.length > 200) {
    throw new Error("That is too many units to hand off in one action.");
  }

  const result = await handOffToFieldService(
    { id: user.id, label: user.name || user.email, orgId: user.orgId },
    serials,
    traceRoot,
  );

  if (result.raised.length === 0) {
    if (result.skippedAlreadyOpen.length > 0) return 0; // already dispatched
    throw new Error("None of those units are deployed — nothing to dispatch.");
  }

  await notify({
    orgId: user.orgId,
    type: "APPROVAL",
    title: `${result.raised.length} field inspection${result.raised.length === 1 ? "" : "s"} raised`,
    body: `Units affected by ${traceRoot} need an on-site check.`,
    target: { type: "Field Service", id: traceRoot },
    url: "/field-service",
  });

  revalidatePath("/blast-radius");
  revalidatePath("/field-service");
  return result.raised.length;
}
