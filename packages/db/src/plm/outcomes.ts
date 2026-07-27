import type { OrgScopedDb } from "../client";

// SEAMS.1 — Seam (b): the PREDICT-layer training substrate, READ-ONLY. Predict will
// train on labels the Record layer ALREADY holds — TestResult pass/fail, NCR
// rootCause, FieldEvent outcomes. This exposes them as one clean per-unit labeled
// set. It captures NOTHING new, adds NO table, and has NO mutation path — it only
// reads what Record already recorded. Predict.1 consumes this; SEAMS.1 does not
// build a model.

export type UnitOutcomeKind = "test" | "ncr" | "field_event";

/** One labeled outcome for a unit — the shape Predict.1 trains on. */
export interface UnitOutcome {
  kind: UnitOutcomeKind;
  /** The label: pass/fail (test) · rootCause or status (NCR) · event kind (field). */
  outcome: string;
  /** When it occurred; null when the Record row carries no timestamp (an NCR). */
  at: Date | null;
  sourceType: "TestResult" | "NCR" | "FieldEvent";
  sourceId: string;
  /** Human code where one exists (TR-8841 · NCR-118). */
  code: string | null;
  /** Ref to the FROZEN config-at-outcome (its named config version) — the join key
   *  Predict trains against. Read from the row's configSnapshot; never recomputed. */
  config: string | null;
}

/** The named config version out of a frozen configSnapshot (the training join key). */
function configRef(snapshot: unknown): string | null {
  const s = snapshot as { configVersion?: { name?: string } | null } | null;
  return s?.configVersion?.name ?? null;
}

/**
 * The per-unit outcome substrate (SEAMS.1 seam b) — a unit's TestResults + NCRs
 * (with rootCause) + FieldEvents as one typed `UnitOutcome[]`. Org-scoped by the
 * `dbForOrg` client, so a second org resolves nothing for another org's unit
 * (per-tenant isolation). READ-ONLY: no create/update/delete, no new capture,
 * no new table — it reads what Record already holds. Predict.1 is the consumer.
 */
export async function unitOutcomes(
  db: OrgScopedDb,
  unitId: string,
): Promise<UnitOutcome[]> {
  const [runs, ncrs, fieldEvents] = await Promise.all([
    db.testRun.findMany({ where: { unitId }, include: { results: true } }),
    db.nCR.findMany({ where: { unitId } }),
    db.fieldEvent.findMany({ where: { unitId } }),
  ]);

  const out: UnitOutcome[] = [];

  // TestResults — the finest test labels; `at`/`config` come from the frozen run.
  for (const run of runs) {
    const config = configRef(run.configSnapshot);
    for (const r of run.results) {
      out.push({
        kind: "test",
        outcome: r.passed ? "pass" : "fail",
        at: run.startedAt,
        sourceType: "TestResult",
        sourceId: r.id,
        code: `${run.code} · ${r.step}`,
        config,
      });
    }
  }

  // NCRs — the RCA label is `rootCause` (falls back to status). NCR has no
  // timestamp column; derive `at` from its linked test run when present.
  for (const n of ncrs) {
    const linked = n.testRunId
      ? runs.find((x) => x.id === n.testRunId)
      : undefined;
    out.push({
      kind: "ncr",
      outcome: n.rootCause ?? n.status,
      at: linked?.startedAt ?? null,
      sourceType: "NCR",
      sourceId: n.id,
      code: n.code,
      config: configRef(n.configSnapshot),
    });
  }

  // FieldEvents — the label is the event kind (fault/maintenance/repair/field_mod).
  for (const fe of fieldEvents) {
    out.push({
      kind: "field_event",
      outcome: fe.kind,
      at: fe.occurredAt,
      sourceType: "FieldEvent",
      sourceId: fe.id,
      code: null,
      config: configRef(fe.configSnapshot),
    });
  }

  // Newest first (undated rows — NCRs without a linked run — sort last).
  out.sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0));
  return out;
}
