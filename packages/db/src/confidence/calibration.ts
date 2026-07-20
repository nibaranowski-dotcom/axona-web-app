import { prisma, type OrgScopedDb } from "../client";

// CONF.1 — calibrated confidence (L2 intelligence spine). Turns an agent's RAW
// confidence into a CALIBRATED one, learned per-org from the ground truth the audit
// log already captures: every gated agent proposal's raw `confidence` + the human
// APPROVED/REJECTED decision (decide() writes `${kind}.approve` / `${kind}.reject`).
// The AuditLog stays the source of truth; the fitted map is persisted small + fast.
//
// The label is a PROXY, stated as such: an approval ≈ the proposal was good. We show
// sampleSize so the weight of the number is legible, and we NEVER fabricate a
// calibrated value below the sample floor — cold start renders raw + "uncalibrated".
// Calibration is EARNED with data, exactly like autonomy is earned with outcomes.

/** Minimum decided proposals before we trust a calibrated number (honest cold start). */
export const MIN_SAMPLES = 20;
/** The advisory autonomy gate TRUST.1 reads (CONF.1 does NOT act on it). */
export const DEFAULT_AUTONOMY_THRESHOLD = 0.85;

export interface CalibrationBin {
  lo: number; // bin lower edge (raw)
  hi: number; // bin upper edge (raw)
  mid: number; // mean raw confidence in the bin (the "stated" x for the curve)
  observed: number; // raw observed approval rate in the bin (the "actual" y)
  rate: number; // monotonic CALIBRATED value (isotonic/PAV-adjusted observed)
  count: number; // decided proposals in the bin (weight)
}

export interface CalibrationModelData {
  bins: CalibrationBin[];
  sampleSize: number;
  fitMethod: "isotonic" | "binned";
  brier: number; // mean (raw − outcome)² — the raw model's calibration error (higher = worse)
  ece: number; // expected calibration error — Σ (n_b/N)·|stated − observed|
  fittedAt: string; // ISO
}

export interface CalibratedConfidence {
  value: number; // the number to show
  state: "calibrated" | "uncalibrated";
  raw: number;
}

interface Sample {
  raw: number;
  approved: boolean;
}

// ── pool-adjacent-violators (isotonic regression) — non-decreasing fit ──────
function pav(values: number[], weights: number[]): number[] {
  const blocks = values.map((v, i) => ({
    sum: v * weights[i]!,
    w: weights[i]!,
    start: i,
    end: i,
  }));
  const stack: typeof blocks = [];
  for (const b of blocks) {
    let cur = { ...b };
    while (
      stack.length > 0 &&
      stack[stack.length - 1]!.sum / stack[stack.length - 1]!.w >
        cur.sum / cur.w
    ) {
      const top = stack.pop()!;
      cur = {
        sum: top.sum + cur.sum,
        w: top.w + cur.w,
        start: top.start,
        end: cur.end,
      };
    }
    stack.push(cur);
  }
  const out = new Array<number>(values.length);
  for (const b of stack) {
    const mean = b.sum / b.w;
    for (let i = b.start; i <= b.end; i++) out[i] = mean;
  }
  return out;
}

/** Fit the per-org raw→calibrated map from decided proposals. Pure (testable). */
export function fitCalibration(samples: Sample[]): CalibrationModelData {
  const N = samples.length;
  // 10 fixed-width bins over [0,1]; keep only the non-empty ones (in raw order).
  const BINS = 10;
  const acc = Array.from({ length: BINS }, () => ({
    n: 0,
    approved: 0,
    rawSum: 0,
  }));
  for (const s of samples) {
    const b = Math.min(BINS - 1, Math.max(0, Math.floor(s.raw * BINS)));
    acc[b]!.n += 1;
    acc[b]!.approved += s.approved ? 1 : 0;
    acc[b]!.rawSum += s.raw;
  }
  const nonEmpty = acc
    .map((a, i) => ({ ...a, i }))
    .filter((a) => a.n > 0)
    .map((a) => ({
      lo: a.i / BINS,
      hi: (a.i + 1) / BINS,
      mid: a.rawSum / a.n,
      observed: a.approved / a.n,
      count: a.n,
    }));

  // Isotonic (monotonic non-decreasing) calibration over the observed rates.
  const calibrated = pav(
    nonEmpty.map((b) => b.observed),
    nonEmpty.map((b) => b.count),
  );
  const bins: CalibrationBin[] = nonEmpty.map((b, i) => ({
    lo: round(b.lo),
    hi: round(b.hi),
    mid: round(b.mid),
    observed: round(b.observed),
    rate: round(calibrated[i]!),
    count: b.count,
  }));

  // Brier = mean (raw − outcome)²; ECE = Σ (n_b/N)·|stated − observed|.
  const brier =
    N > 0
      ? samples.reduce((s, x) => s + (x.raw - (x.approved ? 1 : 0)) ** 2, 0) / N
      : 0;
  const ece =
    N > 0
      ? bins.reduce(
          (s, b) => s + (b.count / N) * Math.abs(b.mid - b.observed),
          0,
        )
      : 0;

  return {
    bins,
    sampleSize: N,
    fitMethod: "isotonic",
    brier: round(brier),
    ece: round(ece),
    fittedAt: new Date().toISOString(),
  };
}

/** Pull the org's decided agent proposals from AuditLog and fit + persist its map.
 *  Idempotent (upsert on [orgId, scope]); org-scoped (an org's calibration uses ONLY
 *  its own outcomes). Wired into the seed after MEM.1. */
export async function calibrate(
  db: OrgScopedDb,
  orgId: string,
): Promise<{ sampleSize: number; ece: number; brier: number }> {
  // Agent proposals that carried a confidence, keyed by their target.
  const proposals = await db.auditLog.findMany({
    where: { actorType: "AGENT", confidence: { not: null } },
    select: {
      targetType: true,
      targetId: true,
      confidence: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const rawByTarget = new Map<string, number>();
  for (const p of proposals) {
    if (p.confidence == null) continue;
    rawByTarget.set(`${p.targetType}:${p.targetId}`, p.confidence);
  }

  // Human decisions from decide(): action ends in ".approve" / ".reject".
  const decisions = await db.auditLog.findMany({
    where: { actorType: "HUMAN" },
    select: { targetType: true, targetId: true, action: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const approvedByTarget = new Map<string, boolean>();
  for (const d of decisions) {
    const approved = d.action.endsWith(".approve");
    const rejected = d.action.endsWith(".reject");
    if (!approved && !rejected) continue;
    approvedByTarget.set(`${d.targetType}:${d.targetId}`, approved); // latest wins
  }

  const samples: Sample[] = [];
  for (const [key, raw] of rawByTarget) {
    const approved = approvedByTarget.get(key);
    if (approved === undefined) continue; // undecided — no label yet
    samples.push({ raw, approved });
  }

  const model = fitCalibration(samples);
  await db.calibrationModel.upsert({
    where: { orgId_scope: { orgId, scope: "org" } },
    update: { model: model as never, sampleSize: model.sampleSize },
    create: {
      orgId,
      scope: "org",
      model: model as never,
      sampleSize: model.sampleSize,
    },
  });
  return { sampleSize: model.sampleSize, ece: model.ece, brier: model.brier };
}

/** Load the org's fitted model (or null). Org-scoped raw fetch; small + cached-ish. */
export async function getCalibrationModel(
  orgId: string,
  scope = "org",
): Promise<CalibrationModelData | null> {
  const row = await prisma.calibrationModel.findUnique({
    where: { orgId_scope: { orgId, scope } },
    select: { model: true },
  });
  return (row?.model as CalibrationModelData | undefined) ?? null;
}

/** Apply the org's map to a raw confidence. Pure. Honest cold start below the floor:
 *  returns raw + state "uncalibrated" — never a fabricated calibrated number. */
export function calibratedConfidence(
  raw: number,
  model: CalibrationModelData | null,
): CalibratedConfidence {
  if (!model || model.sampleSize < MIN_SAMPLES || model.bins.length === 0) {
    return { value: raw, state: "uncalibrated", raw };
  }
  const bins = model.bins;
  // Piecewise-linear interpolation over bin centers (mid → rate). Monotonic because
  // the rates are isotonic and the mids increase.
  let value: number;
  if (raw <= bins[0]!.mid) value = bins[0]!.rate;
  else if (raw >= bins[bins.length - 1]!.mid)
    value = bins[bins.length - 1]!.rate;
  else {
    value = bins[bins.length - 1]!.rate;
    for (let i = 0; i < bins.length - 1; i++) {
      const a = bins[i]!;
      const b = bins[i + 1]!;
      if (raw >= a.mid && raw <= b.mid) {
        const t = b.mid === a.mid ? 0 : (raw - a.mid) / (b.mid - a.mid);
        value = a.rate + t * (b.rate - a.rate);
        break;
      }
    }
  }
  return { value: round(value), state: "calibrated", raw };
}

/** Advisory autonomy gate for TRUST.1 — CONF.1 provides the check, never acts on it.
 *  Money/safety/contract stay human-gated regardless. */
export function meetsAutonomyThreshold(
  calibrated: CalibratedConfidence,
  threshold: number = DEFAULT_AUTONOMY_THRESHOLD,
): boolean {
  // Only a calibrated number can clear the gate — an uncalibrated (cold-start) value
  // is unproven and must not be treated as meeting the bar.
  return calibrated.state === "calibrated" && calibrated.value >= threshold;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
