"use server";

import { revalidatePath } from "next/cache";
import { dbForOrg, writeAudit } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { decide, type ApprovalKind } from "@/lib/approvals";
import type { AgentProposal } from "@/lib/agent-proposal";

/**
 * DEMO.6 — the shared "human decided on an agent finding" path.
 *
 * Beats #4 and #6 each wrote this sequence by hand: materialise the AGENT proposal in
 * the immutable log, route the human verdict through decide() with the DecideContext
 * seam, return the LOOP.1 writeback note. Four more copies would be four chances to
 * drop one of the three steps — and dropping the first one silently breaks CONF.1,
 * because calibrate() pairs an AGENT entry carrying a confidence with a HUMAN
 * .approve/.reject on the same target. One path, so that pairing cannot rot.
 *
 * Why the proposal is written HERE and not when the screen rendered it: the read
 * models are GETs and a GET must not mutate. So the proposal the human acted on is
 * recorded at decision time, with the values the screen showed.
 *
 * SECURITY: the caller passes the proposal it rendered, which a client could forge.
 * Every caller is a server action that re-resolves the proposal from its own read
 * model first (never from client input) — the `resolve` callback below enforces that
 * by construction: this function never accepts a proposal off the wire.
 */
export interface AgentReviewResult {
  upheld: boolean;
  confidence: number;
  loopWriteback: { recorded: boolean; note: string } | null;
}

export async function recordAgentReview(opts: {
  kind: ApprovalKind;
  /** the subject's human code — the decide() targetId and the audit target id. */
  code: string;
  /** re-resolves the proposal SERVER-SIDE from the same read model the screen used. */
  resolve: (orgId: string) => Promise<AgentProposal | null>;
  upheld: boolean;
  /** the agent's display name on the proposal audit entry. */
  agentLabel: string;
  /** AUDIT.1 target type (matches the registry def). */
  targetType: string;
  /** paths to revalidate after the verdict. */
  revalidate: string[];
  /** what the writeback note calls the thing being labelled. */
  subject: string;
}): Promise<AgentReviewResult> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in to review an agent finding.");

  const proposal = await opts.resolve(user.orgId);
  if (!proposal) throw new Error(`No agent finding on ${opts.code} to review.`);

  const db = dbForOrg(user.orgId);

  // 1. the AGENT proposal, in the immutable log, with its real model + confidence.
  await writeAudit(db, {
    orgId: user.orgId,
    actor: { type: "AGENT", id: null, label: opts.agentLabel },
    action: `${opts.kind}.propose`,
    target: { type: opts.targetType, id: opts.code },
    summary: `${opts.agentLabel} on ${opts.code} — ${proposal.text}`,
    inputs: {
      signals: proposal.signals,
      rawConfidence: proposal.rawConfidence,
    },
    output: { action: proposal.action },
    model: proposal.model,
    confidence: proposal.calibrated,
  });

  // 2. the human verdict, through the propose→approve spine (RBAC + TRUST.1 consult
  //    + AUDIT.1 carrying model/confidence/approver + LOOP.1 recordOutcome).
  const res = await decide(
    opts.kind,
    opts.code,
    opts.upheld ? "APPROVE" : "REJECT",
    user,
    {
      proposal: { model: proposal.model, confidence: proposal.calibrated },
      payload: { code: opts.code, finding: proposal.text },
    },
  );
  if (!res.ok) throw new Error(res.message);

  for (const p of opts.revalidate) revalidatePath(p);

  return {
    upheld: opts.upheld,
    confidence: proposal.calibrated,
    loopWriteback: res.loop
      ? {
          recorded: true,
          note: `Outcome episode recorded — the agent's ${proposal.calibrated.toFixed(2)} ${opts.subject} was ${opts.upheld ? "confirmed" : "dismissed"}; this labels the next one.`,
        }
      : { recorded: false, note: "Learning-loop writeback did not record." },
  };
}
