"use server";

import { revalidatePath } from "next/cache";
import { dbForOrg, writeAudit } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { requireRole } from "@/lib/rbac";
import { ROOT_CAUSES } from "@/lib/quality";
import { decide } from "@/lib/approvals";
import { getRcaWorkspace, RCA_AGENT_MODEL } from "@/lib/rca";

// PLM.V2 — RCA root-cause classification.
//
// DEMO.6 #4 — this now has TWO paths, and which one runs depends on whether an agent
// actually proposed a cause for this NCR:
//
//  • An agent PROPOSED a cause  → route through decide("ncr.rootcause"). That is the
//    propose→approve spine: RBAC + TRUST.1 consult + an AUDIT.1 entry carrying
//    input · output · model · confidence · approver + the LOOP.1 recordOutcome
//    writeback. Confirming the agent's cause is an APPROVE; choosing a different one
//    is a REJECT of the proposal (the NCR is still classified either way) — that
//    agree/disagree bit is precisely the label CONF.1 calibrates on.
//
//  • NO proposal (evidence too thin to propose) → the original direct path:
//    requireRole + org-scoped + AUDIT.1. Here the human really is recording a fact
//    with no proposal to approve, which is what PLM.V2's original note described.
//
// So the earlier "not decide()" choice is not reversed so much as outgrown: it was
// conditioned on there being no agent proposal, and named this exact follow-up.

/** DEMO.6 #4 — what the screen shows after a confirmation: the decision, and whether
 *  the learning loop actually recorded an outcome episode for it. */
export interface RootCauseResult {
  rootCause: string;
  /** true when this went through the propose→approve spine (an agent had proposed). */
  viaProposal: boolean;
  /** true when the human's cause matched the agent's. */
  agreedWithAgent: boolean;
  /** The calibrated confidence the decision was recorded against. */
  confidence: number | null;
  /** LOOP.1 — set when recordOutcome actually wrote an OUTCOME episode. */
  loopWriteback: { recorded: boolean; note: string } | null;
}

export async function setNcrRootCauseAction(
  code: string,
  rootCause: string,
): Promise<RootCauseResult> {
  const user = await getCurrentUser();
  requireRole(user, ["ENGINEER", "OPS", "ADMIN"]); // line 1 — before any DB call

  if (!(ROOT_CAUSES as readonly string[]).includes(rootCause)) {
    throw new Error(`Invalid root cause: ${rootCause}`);
  }

  const db = dbForOrg(user.orgId); // org-scoped
  const ncr = await db.nCR.findFirst({ where: { code } });
  if (!ncr) throw new Error(`NCR ${code} not found in this org.`);

  // Did the agent propose a cause for this NCR? The workspace is the SAME read model
  // the screen rendered, so the confidence recorded here is the one the human saw.
  const workspace = await getRcaWorkspace(user.orgId, code);
  const proposal = workspace?.suggestion ?? null;

  if (proposal) {
    // 1. Materialise the AGENT proposal in the immutable log. The read model cannot
    //    write (a GET must not mutate), so the proposal the human acted on is recorded
    //    here, at decision time, with its real model + calibrated confidence. This is
    //    what pairs with the human decision below to become a CONF.1 training sample:
    //    calibrate() reads AGENT entries carrying a confidence and HUMAN entries whose
    //    action ends .approve/.reject on the same target.
    await writeAudit(db, {
      orgId: user.orgId,
      actor: { type: "AGENT", id: null, label: "Root-cause agent" },
      action: "ncr.rootcause.propose",
      target: { type: "NCR", id: code },
      summary: `Proposed ${proposal.cause} for ${code} — ${proposal.rationale}`,
      inputs: {
        signals: proposal.signals,
        rawConfidence: proposal.rawConfidence,
      },
      output: { proposedCause: proposal.cause },
      model: proposal.model,
      confidence: proposal.calibrated,
    });

    // 2. The human's verdict, through the propose→approve spine. decide() does RBAC,
    //    the TRUST.1 consult, the AUDIT.1 entry (now carrying model + confidence via
    //    ctx.proposal) and the LOOP.1 recordOutcome writeback.
    const agreed = rootCause === proposal.cause;
    const res = await decide(
      "ncr.rootcause",
      code,
      agreed ? "APPROVE" : "REJECT",
      user,
      {
        proposal: { model: proposal.model, confidence: proposal.calibrated },
        payload: { cause: rootCause, proposedCause: proposal.cause },
      },
    );
    if (!res.ok) throw new Error(res.message);

    revalidatePath("/quality");
    revalidatePath(`/rca/${code}`);
    return {
      rootCause,
      viaProposal: true,
      agreedWithAgent: agreed,
      confidence: proposal.calibrated,
      loopWriteback: res.loop
        ? {
            recorded: true,
            note: `Outcome episode recorded — the agent's ${proposal.calibrated.toFixed(2)} proposal was ${agreed ? "confirmed" : "overridden"}; this labels the next RCA proposal.`,
          }
        : { recorded: false, note: "Learning-loop writeback did not record." },
    };
  }

  // No proposal to approve — the original PLM.V2 path: a human recording a fact.
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
  revalidatePath(`/rca/${code}`);
  return {
    rootCause,
    viaProposal: false,
    agreedWithAgent: false,
    confidence: null,
    loopWriteback: null,
  };
}
