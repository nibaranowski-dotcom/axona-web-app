"use server";

import { revalidatePath } from "next/cache";
import {
  dbForOrg,
  writeAudit,
  recordFieldModification,
  effectLabel,
  type FieldModChange,
} from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { requireRole } from "@/lib/rbac";

// PLM.V5 — record a field modification. A swap/mod at a deployed unit that drifts
// its configuration; recording it keeps the golden thread intact. This is a real,
// consequential write to the unit's genealogy, so it is RBAC-gated on line 1 and
// audited (inputs · output · actor). Like PLM.V3's as-built capture, the RECORD is
// a human actor recording a fact (requireRole + AUDIT.1). It lands PENDING — the
// config delta only applies when a human APPROVES via decide("field.mod"), so the
// unit's resolved config never moves without an approver. The event's frozen
// config-at-event snapshot is written once here and never recomputed.

export interface RecordFieldModInput {
  serial: string;
  summary: string;
  change: FieldModChange;
  techLabel?: string | null;
}

export async function recordFieldModificationAction(
  input: RecordFieldModInput,
): Promise<{ id: string; effect: string }> {
  const user = await getCurrentUser();
  requireRole(user, ["OPS", "ADMIN", "ENGINEER", "TECH"]); // line 1 — before any DB call

  if (!input.summary?.trim()) throw new Error("Describe the field change.");

  const db = dbForOrg(user.orgId); // org-scoped
  const unit = await db.unit.findFirst({
    where: { serial: input.serial },
    select: { id: true },
  });
  if (!unit) throw new Error(`Unit ${input.serial} not found in this org.`);

  const effect = effectLabel(input.change);
  const rec = await recordFieldModification(db, {
    unitId: unit.id,
    summary: input.summary.trim(),
    change: input.change,
    techLabel: input.techLabel?.trim() || (user.name ?? user.email),
  });

  // AUDIT.1 — inputs · output · actor on the immutable log.
  await writeAudit(db, {
    orgId: user.orgId,
    actor: { type: "HUMAN", id: user.id, label: user.name || user.email },
    action: "fieldmod.record",
    target: { type: "Unit", id: input.serial },
    summary: `Field modification recorded on ${input.serial} — ${input.summary.trim()} (pending approval)`,
    inputs: { serial: input.serial, change: input.change },
    output: { fieldEventId: rec.id, effect, state: rec.state },
    approver: { id: user.id, label: user.name || user.email },
  });

  revalidatePath("/field-service");
  revalidatePath(`/units/${input.serial}`);
  return { id: rec.id, effect };
}
