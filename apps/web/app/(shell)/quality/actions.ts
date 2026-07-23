"use server";

import { revalidatePath } from "next/cache";
import { dbForOrg, writeAudit } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { requireRole } from "@/lib/rbac";
import { ROOT_CAUSES } from "@/lib/quality";

// PLM.V2 — RCA root-cause classification. Classifying an NCR is a consequential
// human judgment on the quality record, so it is RBAC-gated on line 1 and audited
// (inputs · output · actor). Like PLM.5/PLM.V3 it is a human recording a fact, not
// approving an agent proposal — so it follows requireRole + org-scoped + AUDIT.1,
// not decide(). (When an agent PROPOSES a cause, that proposal becomes decide()'s
// target — a later story; the RCA workspace is PLM.8.)

export async function setNcrRootCauseAction(
  code: string,
  rootCause: string,
): Promise<{ rootCause: string }> {
  const user = await getCurrentUser();
  requireRole(user, ["ENGINEER", "OPS", "ADMIN"]); // line 1 — before any DB call

  if (!(ROOT_CAUSES as readonly string[]).includes(rootCause)) {
    throw new Error(`Invalid root cause: ${rootCause}`);
  }

  const db = dbForOrg(user.orgId); // org-scoped
  const ncr = await db.nCR.findFirst({ where: { code } });
  if (!ncr) throw new Error(`NCR ${code} not found in this org.`);

  await db.nCR.update({
    where: { id: ncr.id },
    data: { rootCause: rootCause as never },
  });

  await writeAudit(db, {
    orgId: user.orgId,
    actor: { type: "HUMAN", id: user.id, label: user.name || user.email },
    action: "ncr.rootcause",
    target: { type: "NCR", id: code },
    summary: `Classified ${code} root cause as ${rootCause}`,
    inputs: { code, previous: ncr.rootCause },
    output: { rootCause },
    approver: { id: user.id, label: user.name || user.email },
  });

  revalidatePath("/quality");
  return { rootCause };
}
