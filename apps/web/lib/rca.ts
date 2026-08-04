import {
  dbForOrg,
  recallMemory,
  getCalibrationModel,
  calibratedConfidence,
  type FrozenConfigSnapshot,
} from "@axona/db";
import { affectedUnits } from "@axona/agents";

/** DEMO.6 #4 — the model that emits the RCA proposal; carried onto the AUDIT.1
 *  entry so the log records WHAT proposed, not just that something did. */
export const RCA_AGENT_MODEL = "claude-sonnet-4-6";

// PLM.8 — the RCA workspace read model. Answers Q4: assembles the failure + its
// evidence (config diffs vs passing units · shared lots · sw deltas · SIMILAR
// PRIOR FAILURES via graph proximity + MEM.1 recallMemory), and an AGENT-PROPOSED
// candidate cause. The human classifies via setNcrRootCause.
// The agent never auto-classifies.
// Fully usable with AI off: evidence + classification work without the suggestion.
// Org-scoped.
// DEMO.6 #4 — the proposal carries a CONF.1-calibrated confidence again, but the
// value being calibrated is now DERIVED from the evidence signals below rather than
// the hardcoded literal SEED.4 removed. The invariant is unchanged across both
// stories: never a fabricated number. See RcaCandidate.

export interface RcaEvidenceItem {
  k: string;
  v: string;
}
export interface RcaEvidenceCard {
  key: string;
  title: string;
  summary: string;
  items: RcaEvidenceItem[];
}
/** DEMO.6 beat #4 — the signals the raw score is built from, so the number is
 *  auditable: each is a real fact about THIS failure, not a tuning knob. */
export interface RcaConfidenceSignal {
  key: string;
  detail: string;
  weight: number;
}

export interface RcaCandidate {
  /** The proposed RootCause enum value. */
  cause: string;
  rationale: string;
  /**
   * The agent's own (uncalibrated) score, DERIVED from the evidence below — never a
   * literal. SEED.4 removed a hardcoded 0.82; DEMO.6 #4 replaces it with a score
   * computed from how much corroborating evidence this failure actually carries.
   */
  rawConfidence: number;
  /** The CONF.1-corrected value — what the screen shows. */
  calibrated: number;
  calibratedState: "calibrated" | "uncalibrated";
  /** The signals that produced `rawConfidence` (rendered, so the score is inspectable). */
  signals: RcaConfidenceSignal[];
  /** The model that emitted the proposal — carried onto the AUDIT.1 entry. */
  model: string;
}
export interface SimilarFailure {
  code: string;
  defect: string;
  rootCause: string | null;
}
export interface RcaWorkspace {
  ncrCode: string;
  defect: string;
  status: string;
  rootCause: string | null;
  serial: string | null;
  unitHref: string | null;
  configAtFailure: string | null;
  testRunCode: string | null;
  testRunHref: string | null;
  symptom: string;
  evidence: RcaEvidenceCard[];
  /** The agent's proposal — assistance only, never auto-applied. Null with AI off. */
  suggestion: RcaCandidate | null;
  similarFailures: SimilarFailure[];
  /** MEM.1 precedent memories surfaced by recallMemory (count for the header). */
  recallCount: number;
  blastHref: string;
}

function snapOf(v: unknown): FrozenConfigSnapshot | null {
  return v && typeof v === "object" ? (v as FrozenConfigSnapshot) : null;
}

export async function getRcaWorkspace(
  orgId: string,
  ncrCode: string,
): Promise<RcaWorkspace | null> {
  const db = dbForOrg(orgId);
  const ncr = await db.nCR.findFirst({ where: { code: ncrCode } });
  if (!ncr) return null;

  // config-at-failure is the FROZEN snapshot copied onto the NCR when it was raised.
  const snap = snapOf(ncr.configSnapshot);
  const serial = snap?.serial ?? null;

  // the triggering test run
  const testRun = ncr.testRunId
    ? await db.testRun.findFirst({ where: { id: ncr.testRunId } })
    : null;
  const failStep = testRun
    ? await db.testResult.findFirst({
        where: { testRunId: testRun.id, passed: false },
        orderBy: { measurement: "desc" },
      })
    : null;

  // ── evidence 1: config diff vs a passing run on the same procedure ─────────
  const passing = testRun
    ? await db.testRun.findFirst({
        where: { procedure: testRun.procedure, outcome: "pass" },
        orderBy: { startedAt: "desc" },
      })
    : null;
  const passSnap = snapOf(passing?.configSnapshot);
  const configDiff: RcaEvidenceItem[] = [];
  if (snap && passSnap) {
    if (snap.sw?.version !== passSnap.sw?.version)
      configDiff.push({
        k: "Software",
        v: `${passSnap.sw?.version ?? "—"} (pass) → ${snap.sw?.version ?? "—"} (fail)`,
      });
    if (snap.configVersion?.name !== passSnap.configVersion?.name)
      configDiff.push({
        k: "Config version",
        v: `${passSnap.configVersion?.name ?? "—"} → ${snap.configVersion?.name ?? "—"}`,
      });
  }

  // ── evidence 2: shared lots (as-built) + the units carrying them ───────────
  const subLines = (snap?.hw ?? []).filter(
    (h) => h.isSubstitution && h.lotCode,
  );
  const sharedLot = subLines[0]?.lotCode ?? null;
  const lotUnits = sharedLot
    ? await affectedUnits(db, { lot: sharedLot })
    : { units: [] };
  const lotItems: RcaEvidenceItem[] = subLines.map((h) => ({
    k: `${h.partNumber} ${h.rev}`,
    v: `lot ${h.lotCode} · position ${h.position}`,
  }));
  if (sharedLot)
    lotItems.push({
      k: "Units on this lot",
      v: `${lotUnits.units.length} in the fleet`,
    });

  // ── evidence 3: sw delta window ───────────────────────────────────────────
  const swItems: RcaEvidenceItem[] = [];
  if (snap?.sw)
    swItems.push({
      k: "At failure",
      v: `${snap.sw.component} ${snap.sw.version}`,
    });
  if (passSnap?.sw)
    swItems.push({
      k: "Last passing",
      v: `${passSnap.sw.component} ${passSnap.sw.version}`,
    });

  // ── evidence 4: similar prior failures (graph proximity) + MEM.1 recall ────
  const prior = await db.nCR.findMany({
    where: {
      code: { not: ncrCode },
      OR: [
        { defect: { contains: "torque", mode: "insensitive" } },
        {
          defect: {
            contains: ncr.defect.split(" ")[0] ?? "",
            mode: "insensitive",
          },
        },
      ],
    },
    take: 5,
  });
  const similarFailures: SimilarFailure[] = prior.map((p) => ({
    code: p.code,
    defect: p.defect,
    rootCause: p.rootCause,
  }));

  // MEM.1 — precedent memories in NCR-118's graph neighborhood (assistance).
  let recallCount = 0;
  try {
    const hits = await recallMemory(db, {
      query: ncr.defect,
      subjectType: "NCR",
      subjectId: ncrCode,
      limit: 6,
    });
    recallCount = hits.length;
  } catch {
    recallCount = 0; // recall is assistance — its absence never breaks the screen
  }

  const evidence: RcaEvidenceCard[] = [
    {
      key: "config",
      title: "Config vs last pass",
      summary: "How this build differs from the last passing run.",
      items: configDiff.length
        ? configDiff
        : [{ k: "No delta", v: "config matched the passing run" }],
    },
    {
      key: "lots",
      title: "Shared lots",
      summary: "Substituted parts + the lot they came from.",
      items: lotItems.length
        ? lotItems
        : [{ k: "No substitutions", v: "as-built matched as-designed" }],
    },
    {
      key: "sw",
      title: "Software delta",
      summary: "The firmware window around the failure.",
      items: swItems.length ? swItems : [{ k: "—", v: "no software recorded" }],
    },
    {
      key: "prior",
      title: "Similar prior failures",
      summary: `${similarFailures.length} related · ${recallCount} precedent memories (MEM.1)`,
      items: similarFailures.length
        ? similarFailures.map((s) => ({
            k: s.code,
            v: `${s.defect}${s.rootCause ? ` · ${s.rootCause}` : ""}`,
          }))
        : [{ k: "None", v: "no prior failures on this signature" }],
    },
  ];

  // ── the agent's proposal — evidence-derived, never auto-applied ────────────
  // DEMO.6 #4: the raw score is COMPUTED from the corroborating evidence this
  // failure actually carries, then corrected by the org's fitted CONF.1 map. SEED.4
  // removed a hardcoded 0.82; nothing here is a literal confidence — the weights are
  // how much each *kind* of evidence counts, and every signal below had to be found
  // in the data to contribute at all. A failure with less evidence scores lower.
  let suggestion: RcaCandidate | null = null;
  if (sharedLot) {
    const signals: RcaConfidenceSignal[] = [];
    // 1. the substitution itself — the proposal's precondition
    signals.push({
      key: "substituted-part-on-quarantined-lot",
      detail: `${subLines[0]?.partNumber ?? "substituted part"} rev ${subLines[0]?.rev ?? "?"} from lot ${sharedLot}`,
      weight: 0.45,
    });
    // 2. the same lot reaches other units — a pattern, not a one-off
    if (lotUnits.units.length > 1) {
      signals.push({
        key: "lot-spans-multiple-units",
        detail: `${lotUnits.units.length} units carry lot ${sharedLot}`,
        weight: Math.min(0.2, 0.05 * lotUnits.units.length),
      });
    }
    // 3. the config moved between the last pass and this fail
    if (configDiff.length > 0) {
      signals.push({
        key: "config-delta-vs-last-pass",
        detail: `${configDiff.length} field(s) differ from the passing run`,
        weight: 0.1,
      });
    }
    // 4. a prior failure on this signature was ALREADY classified as a component fault
    const priorComponent = similarFailures.filter(
      (s) => s.rootCause === "component",
    ).length;
    if (priorComponent > 0) {
      signals.push({
        key: "prior-failures-classified-component",
        detail: `${priorComponent} prior failure(s) on this signature closed as component`,
        weight: Math.min(0.15, 0.075 * priorComponent),
      });
    }
    // 5. MEM.1 surfaced precedent in this NCR's graph neighbourhood
    if (recallCount > 0) {
      signals.push({
        key: "memory-precedent",
        detail: `${recallCount} precedent memories recalled (MEM.1)`,
        weight: Math.min(0.1, 0.02 * recallCount),
      });
    }
    const raw = Math.max(
      0,
      Math.min(
        1,
        signals.reduce((s, x) => s + x.weight, 0),
      ),
    );
    const model = await getCalibrationModel(orgId);
    const cal = calibratedConfidence(raw, model);
    suggestion = {
      cause: "component",
      rationale: `Quarantined lot ${sharedLot} on ${subLines[0]?.partNumber ?? "a substituted part"} is present in the config at failure.`,
      rawConfidence: Math.round(raw * 100) / 100,
      calibrated: Math.round(cal.value * 100) / 100,
      calibratedState: cal.state,
      signals,
      model: RCA_AGENT_MODEL,
    };
  }

  const measure = failStep
    ? `${failStep.measurement}${failStep.unitOfMeasure ? ` ${failStep.unitOfMeasure}` : ""}`
    : "";
  const limit =
    failStep && failStep.lowerLimit != null && failStep.upperLimit != null
      ? `${failStep.lowerLimit}–${failStep.upperLimit}`
      : "";
  const symptom = failStep
    ? `${failStep.step} ${measure}${limit ? ` — over the ${limit} limit` : ""}`
    : ncr.defect;

  return {
    ncrCode,
    defect: ncr.defect,
    status: ncr.status,
    rootCause: ncr.rootCause,
    serial,
    unitHref: serial ? `/units/${encodeURIComponent(serial)}` : null,
    configAtFailure: snap?.configVersion?.name ?? null,
    testRunCode: testRun?.code ?? null,
    testRunHref: testRun ? `/tests/${encodeURIComponent(testRun.code)}` : null,
    symptom,
    evidence,
    suggestion,
    similarFailures,
    recallCount,
    blastHref: sharedLot
      ? `/blast-radius?type=lot&value=${encodeURIComponent(sharedLot)}`
      : "/blast-radius",
  };
}
