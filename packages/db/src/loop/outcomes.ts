import type { OrgScopedDb } from "../client";
import type { OutcomeVerdict } from "./writeback";

// LOOP.1 — the labeled substrate. A thin, READ-ONLY view over the OUTCOME episodes
// LOOP.1 wrote: the agent's stated confidence paired with the human's verdict = the
// label CONF.1's calibration consumes. Org-scoped via `db`. LOOP.1 PROVIDES the labels;
// CONF.1 owns fitting — this does NOT refit anything, it just makes the pipe real.

export interface DecisionOutcome {
  /** The proposing agent (denormalized label), or null if none proposed. */
  agent: string | null;
  /** The gated action-kind (from the linked AUDIT.1 entry's action verb). */
  actionKind: string;
  /** What the outcome is about, anchored into the ontology. */
  subjectRef: { type: string; id: string } | null;
  /** The agent's uncalibrated emitted confidence (the CONF.1 input side of the label). */
  statedConfidence: number | null;
  /** The human's verdict (the CONF.1 ground-truth side of the label). */
  verdict: OutcomeVerdict;
  /** 0 = accepted as-is … 1 = fully overrode. */
  delta: number;
  at: Date;
  /** The AUDIT.1 entry this outcome links to (immutable provenance). */
  auditRef: string;
}

export interface DecisionOutcomesFilter {
  agent?: string;
  actionKind?: string;
  since?: Date;
}

/** Strip the "#outcome" suffix → the linked AUDIT.1 entry id. */
const auditRefOf = (sourceId: string) => sourceId.replace(/#outcome$/, "");
/** OVERRIDDEN/REVERSED moved the human away from the agent (delta 1); APPROVED took it as-is (0). */
const deltaFor = (verdict: string) => (verdict === "APPROVED" ? 0 : 1);

/**
 * Read the org's decision outcomes as a typed labeled set. Org-scoped, read-only.
 * `actionKind` filters against the linked AUDIT.1 entry's action (LOOP.1 reads the log,
 * never mutates it). A second org sees zero of this org's outcomes (per-tenant isolation).
 */
export async function decisionOutcomes(
  db: OrgScopedDb,
  filter: DecisionOutcomesFilter = {},
): Promise<DecisionOutcome[]> {
  const episodes = await db.memoryItem.findMany({
    where: {
      kind: "OUTCOME",
      ...(filter.agent ? { actorLabel: filter.agent } : {}),
      ...(filter.since ? { occurredAt: { gte: filter.since } } : {}),
    },
    orderBy: { occurredAt: "desc" },
    select: {
      actorLabel: true,
      subjectType: true,
      subjectId: true,
      confidence: true,
      outcome: true,
      occurredAt: true,
      sourceId: true,
    },
  });
  if (episodes.length === 0) return [];

  // Link each episode to its AUDIT.1 entry for the action-kind (read-only join).
  const auditIds = episodes.map((e) => auditRefOf(e.sourceId));
  const audits = await db.auditLog.findMany({
    where: { id: { in: auditIds } },
    select: { id: true, action: true },
  });
  const actionById = new Map(audits.map((a) => [a.id, a.action]));

  const rows: DecisionOutcome[] = episodes.map((e) => {
    const auditRef = auditRefOf(e.sourceId);
    const verdict = (e.outcome ?? "OVERRIDDEN") as OutcomeVerdict;
    return {
      agent: e.actorLabel,
      // The audit action is the decision verb (e.g. "po.approve.reject"); take its kind.
      actionKind: (actionById.get(auditRef) ?? "").replace(
        /\.(approve|reject)$/,
        "",
      ),
      subjectRef:
        e.subjectType && e.subjectId
          ? { type: e.subjectType, id: e.subjectId }
          : null,
      statedConfidence: e.confidence,
      verdict,
      delta: deltaFor(verdict),
      at: e.occurredAt,
      auditRef,
    };
  });

  return filter.actionKind
    ? rows.filter((r) => r.actionKind === filter.actionKind)
    : rows;
}
