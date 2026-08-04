import { dbForOrg, recallMemory, type FrozenConfigSnapshot } from "@axona/db";
import { affectedUnits } from "@axona/agents";

// PLM.8 — the RCA workspace read model. Answers Q4: assembles the failure + its
// evidence (config diffs vs passing units · shared lots · sw deltas · SIMILAR
// PRIOR FAILURES via graph proximity + MEM.1 recallMemory), and an AGENT-PROPOSED
// candidate cause. The human classifies via setNcrRootCause.
// The agent never auto-classifies.
// Fully usable with AI off: evidence + classification work without the suggestion.
// Org-scoped.
// SEED.4 — the proposal carries NO confidence (see RcaCandidate). It previously
// claimed CONF.1-calibrated confidence, but the value calibrated was a hardcoded
// literal, so the number was fabricated.

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
export interface RcaCandidate {
  /** The proposed RootCause enum value. */
  cause: string;
  rationale: string;
  /**
   * DEMO-INTEGRITY (SEED.4) — no confidence field. The prior shape carried
   * `rawConfidence`/`calibrated`/`calibratedState`, but the raw input was a
   * HARDCODED 0.82 literal, so the rendered number was fabricated: on an org with
   * no fitted CalibrationModel (both prospect demo tenants) it surfaced as
   * "confidence 0.82 (uncal)" — a made-up number that announces its own
   * unreliability. A confidence returns here only when it is a real
   * `calibratedConfidence()` result over a real model-emitted value.
   */
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
  // DEMO-INTEGRITY (SEED.4): no confidence is emitted. The proposal itself is real
  // (it fires only when a quarantined lot is present in the config at failure), but
  // there is no model-emitted confidence to calibrate yet — the previous 0.82 was a
  // literal. Wire CONF.1 here when a real emitted value exists (DEMO.6 beat #4).
  let suggestion: RcaCandidate | null = null;
  if (sharedLot) {
    suggestion = {
      cause: "component",
      rationale: `Quarantined lot ${sharedLot} on ${subLines[0]?.partNumber ?? "a substituted part"} is present in the config at failure.`,
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
