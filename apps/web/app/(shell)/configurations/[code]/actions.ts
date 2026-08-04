"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { decide } from "@/lib/approvals";
import { compareConfigs, type ConfigDiff } from "@/lib/configurations";

// PLM.11 — the Configuration detail's gated actions. Lock/unlock route through
// decide() (RBAC-gated + audited); both are DUAL-APPROVER (a single approver can't
// finalize a lock; the locker can't unlock their own baseline). Compare is read-only.

/** Propose or finalize a lock via decide("config.lock"). Returns the resulting status
 *  ("awaiting_second" | "locked") so the UI can reflect the dual-approver step. */
export async function lockConfigAction(
  configId: string,
): Promise<{ status: string; summary: string }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in to lock a configuration.");
  const res = await decide("config.lock", configId, "APPROVE", user);
  if (!res.ok) throw new Error(res.message);
  revalidatePath(`/configurations`);
  return { status: res.status, summary: res.summary };
}

/** Unlock a baseline via decide("config.unlock") — a second approver (not the locker). */
export async function unlockConfigAction(
  configId: string,
): Promise<{ status: string; summary: string }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in to unlock a configuration.");
  const res = await decide("config.unlock", configId, "APPROVE", user);
  if (!res.ok) throw new Error(res.message);
  revalidatePath(`/configurations`);
  return { status: res.status, summary: res.summary };
}

/** DEMO.6 #6 — what the screen shows after a drift review is decided. */
export interface ConfigReviewResult {
  upheld: boolean;
  confidence: number;
  loopWriteback: { recorded: boolean; note: string } | null;
}

/**
 * DEMO.6 #6 — confirm or dismiss the configuration agent's drift assessment.
 *
 * Routes through decide("config.review") with the DecideContext seam beat #4 added,
 * so the AUDIT.1 entry carries input · output · model · confidence · approver, and
 * LOOP.1's recordOutcome fires on the verdict. The confidence recorded is re-read
 * from the SAME read model the screen rendered — never passed in from the client,
 * which would let a caller assert any number it liked.
 *
 * Leaves the dual-approver baseline lock (config.lock/unlock, above) untouched.
 */
export async function reviewConfigDriftAction(
  code: string,
  upheld: boolean,
): Promise<ConfigReviewResult> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in to review a configuration.");

  const { getConfigurationDetail } = await import("@/lib/configurations");
  const detail = await getConfigurationDetail(user.orgId, code);
  const proposal = detail?.agent;
  if (!proposal) throw new Error(`No agent assessment on ${code} to review.`);

  // Materialise the AGENT proposal in the immutable log (the read model cannot write
  // — a GET must not mutate), so this verdict pairs with a real stated confidence and
  // becomes a CONF.1 training sample. Same shape as the RCA hero.
  const { dbForOrg, writeAudit } = await import("@axona/db");
  const db = dbForOrg(user.orgId);
  await writeAudit(db, {
    orgId: user.orgId,
    actor: { type: "AGENT", id: null, label: "Configuration agent" },
    action: "config.review.propose",
    target: { type: "ConfigurationVersion", id: code },
    summary: `Drift assessment on ${code} — ${proposal.text}`,
    inputs: {
      signals: proposal.signals,
      rawConfidence: proposal.rawConfidence,
    },
    output: { driftFound: proposal.driftFound, action: proposal.action },
    model: proposal.model,
    confidence: proposal.calibrated,
  });

  const res = await decide(
    "config.review",
    code,
    upheld ? "APPROVE" : "REJECT",
    user,
    {
      proposal: { model: proposal.model, confidence: proposal.calibrated },
      payload: { finding: proposal.text },
    },
  );
  if (!res.ok) throw new Error(res.message);

  revalidatePath(`/configurations`);
  revalidatePath(`/configurations/${code}`);
  return {
    upheld,
    confidence: proposal.calibrated,
    loopWriteback: res.loop
      ? {
          recorded: true,
          note: `Outcome episode recorded — the agent's ${proposal.calibrated.toFixed(2)} assessment was ${upheld ? "confirmed" : "dismissed"}; this labels the next configuration review.`,
        }
      : { recorded: false, note: "Learning-loop writeback did not record." },
  };
}

/** Diff two configuration versions (read-only, org-scoped) — reuses compareConfigs. */
export async function compareConfigsAction(
  a: string,
  b: string,
): Promise<ConfigDiff> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in to compare.");
  const diff = await compareConfigs(user.orgId, a, b);
  if (!diff) throw new Error("One or both configurations were not found.");
  return diff;
}
