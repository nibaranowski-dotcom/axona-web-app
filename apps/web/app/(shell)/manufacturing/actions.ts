"use server";

import { revalidatePath } from "next/cache";
import { dbForOrg, captureAsBuilt, writeAudit } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { requireRole } from "@/lib/rbac";

// PLM.V3 — the as-built capture write. Scanning a component at build is a real,
// consequential write to the unit's genealogy, so it is RBAC-gated on line 1 and
// audited (inputs · output · actor). Like PLM.5's hand-off it is a human actor
// recording a fact, not an approval of an agent proposal — so it follows the
// requireRole + org-scoped + AUDIT.1 bar, not decide(). The diff (substitution or
// match) is computed AT WRITE TIME inside captureAsBuilt and stored.

export async function captureComponentAction(input: {
  serial: string;
  bomPosition: string;
  partRevisionId: string;
  lotCode?: string | null;
  componentSerial?: string | null;
}): Promise<{ isSubstitution: boolean }> {
  const user = await getCurrentUser();
  requireRole(user, ["OPS", "ADMIN", "ENGINEER"]); // line 1 — before any DB call

  const db = dbForOrg(user.orgId); // org-scoped
  const unit = await db.unit.findFirst({
    where: { serial: input.serial },
    select: { id: true },
  });
  if (!unit) throw new Error(`Unit ${input.serial} not found in this org.`);

  const result = await captureAsBuilt(db, {
    unitId: unit.id,
    bomPosition: input.bomPosition,
    partRevisionId: input.partRevisionId,
    lotCode: input.lotCode ?? null,
    componentSerial: input.componentSerial ?? null,
    installedById: user.id,
  });

  // AUDIT.1 — inputs · output · actor on the immutable log.
  await writeAudit(db, {
    orgId: user.orgId,
    actor: { type: "HUMAN", id: user.id, label: user.name || user.email },
    action: "asbuilt.capture",
    target: { type: "Unit", id: input.serial },
    summary: `Captured ${input.bomPosition} on ${input.serial}${
      result.isSubstitution ? " (substitution)" : ""
    }`,
    inputs: {
      position: input.bomPosition,
      partRevisionId: input.partRevisionId,
      lotCode: input.lotCode ?? null,
    },
    output: { isSubstitution: result.isSubstitution },
    approver: { id: user.id, label: user.name || user.email },
  });

  revalidatePath("/manufacturing");
  revalidatePath(`/units/${input.serial}`);
  revalidatePath(`/units/${input.serial}/as-built`);
  return { isSubstitution: result.isSubstitution };
}
