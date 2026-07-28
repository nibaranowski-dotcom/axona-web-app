import type { OrgScopedDb } from "../client";
import type { Embedder } from "../embed/embedder";
import { embedPending, TARGET_TO_ENTITY } from "../memory/ingest";
import type { EntityType } from "../memory/recall";

// LOOP.1 — the learning loop's WRITEBACK edge. Today a human's verdict on an agent
// proposal dies in the audit log. recordOutcome turns each verdict into a structured
// OUTCOME episode in the MEM.1 store (reusing MemoryItem — no parallel store), so:
//   • MEM.2 auto-injects "last time the human overrode this" into the NEXT proposal, and
//   • CONF.1 has a real label (stated confidence vs the human's verdict) to calibrate against.
// It LINKS to the AUDIT.1 entry (sourceId = "<auditId>#outcome") — never mutates it — and
// is IDEMPOTENT per audit-entry id (the MemoryItem @@unique[orgId,sourceType,sourceId] makes
// a re-run a no-op, protecting TRUST.1's counts + CONF.1's labels from double-writes).
// Retraining stays stubbed (SLM/LOOP.2): this makes the DATA FLOW real, not the training.

/** The human's verdict on the agent's proposal. REVERSED is reserved for a later
 *  reversal path (not produced by decide() today). */
export type OutcomeVerdict = "APPROVED" | "OVERRIDDEN" | "REVERSED";

export interface RecordOutcomeInput {
  /** The AUDIT.1 entry this outcome is derived from (provenance + idempotency key). */
  auditEntryId: string;
  /** The human's decision from decide(). */
  decision: "APPROVE" | "REJECT";
  /** The gated action-kind, e.g. "po.approve" (kept for the trace + readability). */
  actionKind: string;
  /** AUDIT.1 targetType (a Prisma model name) + id — anchors the episode's subject. */
  targetType: string;
  targetId: string;
  /** The deciding human (denormalized approver label). */
  approverLabel: string;
  /** When the decision happened (the audit entry's time). */
  occurredAt: Date;
  embedder?: Embedder;
}

export interface RecordOutcomeResult {
  /** The MEM.1 episode id (MEM-…), or null when nothing was written (no audit link). */
  episodeId: string | null;
  verdict: OutcomeVerdict;
  /** How far the human moved from the agent: 0 = accepted as-is … 1 = fully overrode. */
  delta: number;
  /** false when idempotent (the episode already existed for this audit entry). */
  created: boolean;
  /** The legible `loop` trace line to surface on writeback. */
  trace: string;
}

/** decide() only emits APPROVE/REJECT. A REJECT at the gate IS the human overriding the
 *  agent's proposal (delta 1); an APPROVE takes it as-is (delta 0). */
function verdictFor(decision: "APPROVE" | "REJECT"): {
  verdict: OutcomeVerdict;
  delta: number;
} {
  return decision === "APPROVE"
    ? { verdict: "APPROVED", delta: 0 }
    : { verdict: "OVERRIDDEN", delta: 1 };
}

const outcomeSourceId = (auditEntryId: string) => `${auditEntryId}#outcome`;

/**
 * Write the outcome episode for a decision. Org-scoped by `db`, idempotent per audit
 * entry, immediately recall-able (reuses MEM.1's embed path). Returns the episode id +
 * the `loop` trace line. Never throws into the caller's transaction — a writeback
 * failure must not undo the decision (the audit entry is the durable record).
 */
export async function recordOutcome(
  db: OrgScopedDb,
  input: RecordOutcomeInput,
): Promise<RecordOutcomeResult> {
  const { verdict, delta } = verdictFor(input.decision);
  const sourceId = outcomeSourceId(input.auditEntryId);
  const trace = (episodeId: string | null) =>
    `recorded outcome: ${input.actionKind} ${verdict} → memory ep ${episodeId ?? "—"}`;

  try {
    // The proposing agent (label + stated confidence + model) — the CONF.1 label pairs
    // the agent's stated confidence with this human verdict. Read-only over AUDIT.1.
    const proposal = await db.auditLog.findFirst({
      where: {
        actorType: "AGENT",
        targetType: input.targetType,
        targetId: input.targetId,
      },
      orderBy: { createdAt: "asc" },
      select: { actorLabel: true, confidence: true, model: true },
    });
    const agentLabel = proposal?.actorLabel ?? null;
    const statedConfidence = proposal?.confidence ?? null;

    // Idempotent: one outcome episode per audit entry (the MemoryItem @@unique).
    const existing = await db.memoryItem.findFirst({
      where: { sourceType: "AuditLog", sourceId },
      select: { id: true },
    });
    if (existing) {
      return {
        episodeId: existing.id,
        verdict,
        delta,
        created: false,
        trace: trace(existing.id),
      };
    }

    const subjectType: EntityType | null =
      TARGET_TO_ENTITY[input.targetType] ?? null;
    const subjectId = subjectType ? input.targetId : null;
    const who = agentLabel ?? "the agent";
    const summary =
      verdict === "OVERRIDDEN"
        ? `Human OVERRODE ${who}'s ${input.actionKind} proposal on ${input.targetType} ${input.targetId} — rejected at the approval gate. Last time we saw this, the human did not take the agent's recommendation.`
        : `Human APPROVED ${who}'s ${input.actionKind} proposal on ${input.targetType} ${input.targetId} as proposed (no change). Last time we saw this, the human agreed with the agent.`;

    const ep = await db.memoryItem.create({
      data: {
        orgId: db.$org,
        kind: "OUTCOME",
        summary,
        subjectType,
        subjectId,
        sourceType: "AuditLog",
        sourceId, // "<auditId>#outcome" — links to (never mutates) the immutable entry
        outcome: verdict,
        actorLabel: agentLabel,
        approverLabel: input.approverLabel,
        model: proposal?.model ?? null,
        confidence: statedConfidence, // uncalibrated stated signal — CONF.1's label
        occurredAt: input.occurredAt,
      },
      select: { id: true },
    });

    // Reuse MEM.1's embed path so the episode is immediately recall-able by MEM.2.
    await embedPending(db.$org, input.embedder);

    return {
      episodeId: ep.id,
      verdict,
      delta,
      created: true,
      trace: trace(ep.id),
    };
  } catch (err) {
    // Best-effort like writeAudit — never break the decision on a writeback failure.
    console.error(
      `[recordOutcome] failed for audit ${input.auditEntryId} —`,
      (err as Error).message,
    );
    return {
      episodeId: null,
      verdict,
      delta,
      created: false,
      trace: trace(null),
    };
  }
}
