import {
  calibratedConfidence,
  type CalibrationModelData,
} from "../confidence/calibration";

// TRUST.1 — the progressive-trust ladder. Autonomy is EARNED (from the audited track
// record) + MEASURED (a pure deterministic function) + VISIBLE (the surface below).
// This module GRANTS NO NEW AUTONOMY: it defines the rungs, computes where each
// (agent, actionKind) sits from its history + CONF.1 calibration, and models the top
// AUTO rung as DEFINED-BUT-DISABLED. `decide()` consults the rung (advisory + recorded)
// but never auto-approves a gated (money/safety/contract) kind — a hard ceiling here.
//
// The rung is COMPUTED, never stored/assigned — read on demand from AUDIT.1. No new
// table (the immutable log already holds the truth).

/** The ladder — a single ordered enum, kind-agnostic, applied per (agent, actionKind). */
export type TrustRung =
  | "SUGGEST" // draft/annotate only — the human does everything (cold-start default)
  | "RECOMMEND" // pre-fill a proposal + confidence — human approves every time
  | "REVIEW_LIGHT" // non-gated low-risk only — batch one-click approve, still human-in-loop
  | "AUTO_BOUNDED"; // DEFINED, NOT ENABLED this story — gated kinds can NEVER reach it

/** Ascending order — index = height on the ladder. */
export const RUNG_ORDER: TrustRung[] = [
  "SUGGEST",
  "RECOMMEND",
  "REVIEW_LIGHT",
  "AUTO_BOUNDED",
];
const rank = (r: TrustRung) => RUNG_ORDER.indexOf(r);

// ── the global off-switch (build only Record) ──────────────────────────────────
// The AUTO rung is modeled so the surface is honest about where the ladder goes, but
// it is DISABLED by default — nothing computes to it and `decide()` never acts on it.
// LOOP.1/Act flips this later, per non-gated kind, on an earned record — never here.
export const AUTO_BOUNDED_ENABLED = false;

// ── explicit thresholds per rung (deterministic, testable) ──────────────────────
export const TRUST_THRESHOLDS = {
  /** Decided proposals needed before advancing past SUGGEST (no trust from one sample). */
  RECOMMEND: { minVolume: 10, minApproval: 0.6, maxOverride: 0.4 },
  /** REVIEW_LIGHT needs a longer, cleaner record — and a non-gated kind. */
  REVIEW_LIGHT: { minVolume: 25, minApproval: 0.8, maxOverride: 0.15 },
} as const;

/** Over-confidence: stated confidence materially above the realized approval rate.
 *  This is the local CONF.1 signal for the cell — an over-confident history caps the rung. */
export const CALIBRATION_DELTA = 0.15;

// ── gated-kind classification (money / safety / contract) ───────────────────────
// A cell's actionKind is the agent-proposal verb (e.g. "po.draft", "eco.release",
// "delivery.schedule"). Gated kinds have a HARD auto ceiling (max rung RECOMMEND) —
// they can never be gated to an auto rung regardless of the record. Unknown kinds
// default to GATED (fail-safe: never auto-grant an unclassified kind).
const GATED_PREFIXES = new Set([
  "po", // purchase orders — money/contract
  "eco", // engineering release — contract/safety
  "policy", // policy rollback — safety
  "creditnote", // credit notes — money
  "invoice", // invoicing — money
  "payment", // payments — money
  "contract", // contracts — contract
  "safety", // safety actions — safety
]);
/** Non-gated, low-risk kinds — may climb to REVIEW_LIGHT (AUTO stays disabled). */
const LOW_RISK_PREFIXES = new Set([
  "delivery", // fulfillment scheduling
  "config", // baseline/config lock
  "workflow", // workflow gates
  "field", // field-modification records
  "assignment", // routing/assignment
  "schedule", // scheduling
  "draft", // generic drafting
  "note", // annotations
]);

/** True if the action-kind is money/safety/contract (hard auto ceiling). */
export function isGatedActionKind(actionKind: string): boolean {
  const prefix = actionKind.split(".")[0]?.toLowerCase() ?? "";
  if (GATED_PREFIXES.has(prefix)) return true;
  if (LOW_RISK_PREFIXES.has(prefix)) return false;
  return true; // fail-safe: unknown → gated (never auto-grant the unclassified)
}

/** The highest rung a kind can ever reach in THIS story (the ceiling). */
export function ceilingFor(actionKind: string): TrustRung {
  if (isGatedActionKind(actionKind)) return "RECOMMEND"; // hard ceiling — money/safety/contract
  return AUTO_BOUNDED_ENABLED ? "AUTO_BOUNDED" : "REVIEW_LIGHT";
}

export interface TrustInput {
  actionKind: string;
  /** Approved decided proposals. */
  approvals: number;
  /** Rejected decided proposals. */
  rejections: number;
  /** Later-reversed approvals (0 for now — reserved for LOOP.1). */
  reversals?: number;
  /** Mean emitted confidence over the cell's proposals (null if none emitted). */
  avgStatedConfidence: number | null;
  /** The org's CONF.1 calibration model (for the honest-confidence view). */
  calibration: CalibrationModelData | null;
}

export interface TrustMetrics {
  /** Decided proposals = approvals + rejections. */
  volume: number;
  approvalRate: number;
  overrideRate: number;
  avgStatedConfidence: number | null;
  /** The org-calibrated value of the stated confidence (CONF.1), when available. */
  calibratedConfidence: number | null;
  calibrationState: "calibrated" | "uncalibrated" | "not-measured";
  /** stated − realized-approval > CALIBRATION_DELTA → the cell over-states confidence. */
  overconfident: boolean;
}

export type CappedBy =
  | "volume"
  | "approval"
  | "override"
  | "calibration"
  | "ceiling"
  | null;

export interface TrustResult {
  rung: TrustRung;
  /** The most this kind can reach in this story (RECOMMEND for gated kinds). */
  ceiling: TrustRung;
  gated: boolean;
  metrics: TrustMetrics;
  /** The next rung the cell could reach next (null if at a hard/disabled ceiling). */
  nextRung: TrustRung | null;
  /** Plain-language "what's needed to advance" (or why it's capped). */
  nextRungCriteria: string[];
  /** The binding constraint keeping the rung from going one higher. */
  cappedBy: CappedBy;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * computeTrust — the pure, deterministic heart. Maps a cell's audited record + CONF.1
 * calibration to a rung with explicit thresholds. No model call, no I/O, no clock.
 */
export function computeTrust(input: TrustInput): TrustResult {
  const reversals = input.reversals ?? 0;
  const volume = input.approvals + input.rejections;
  const approvalRate = volume === 0 ? 0 : input.approvals / volume;
  const overrideRate =
    volume === 0 ? 0 : (input.rejections + reversals) / volume;

  // Local calibration signal: stated confidence vs the realized approval rate.
  const avg = input.avgStatedConfidence;
  const overconfident = avg != null && avg - approvalRate > CALIBRATION_DELTA;
  const cal = avg != null ? calibratedConfidence(avg, input.calibration) : null;

  const metrics: TrustMetrics = {
    volume,
    approvalRate,
    overrideRate,
    avgStatedConfidence: avg,
    calibratedConfidence: cal ? cal.value : null,
    calibrationState: cal ? cal.state : "not-measured",
    overconfident,
  };

  const gated = isGatedActionKind(input.actionKind);
  const ceiling = ceilingFor(input.actionKind);

  // Which record-based criteria a target rung needs, and whether they're met.
  const meetsRecommend =
    volume >= TRUST_THRESHOLDS.RECOMMEND.minVolume &&
    approvalRate >= TRUST_THRESHOLDS.RECOMMEND.minApproval &&
    overrideRate <= TRUST_THRESHOLDS.RECOMMEND.maxOverride &&
    !overconfident;
  const meetsReview =
    meetsRecommend &&
    volume >= TRUST_THRESHOLDS.REVIEW_LIGHT.minVolume &&
    approvalRate >= TRUST_THRESHOLDS.REVIEW_LIGHT.minApproval &&
    overrideRate <= TRUST_THRESHOLDS.REVIEW_LIGHT.maxOverride &&
    !overconfident;

  // Base rung from the record alone (kind-agnostic), then clamp to the kind's ceiling.
  let base: TrustRung = "SUGGEST";
  if (meetsReview) base = "REVIEW_LIGHT";
  else if (meetsRecommend) base = "RECOMMEND";
  const rung: TrustRung = rank(base) > rank(ceiling) ? ceiling : base;

  // The next attainable rung + what advancing needs (or why it's capped).
  const { nextRung, nextRungCriteria, cappedBy } = advanceGuide(
    rung,
    ceiling,
    gated,
    metrics,
  );

  return {
    rung,
    ceiling,
    gated,
    metrics,
    nextRung,
    nextRungCriteria,
    cappedBy,
  };
}

/** The "what advances it" story for the surface — explicit + honest. */
function advanceGuide(
  rung: TrustRung,
  ceiling: TrustRung,
  gated: boolean,
  m: TrustMetrics,
): {
  nextRung: TrustRung | null;
  nextRungCriteria: string[];
  cappedBy: CappedBy;
} {
  // At the kind's ceiling → explain the cap; nothing to advance to in this story.
  if (rank(rung) >= rank(ceiling)) {
    if (gated) {
      return {
        nextRung: null,
        cappedBy: "ceiling",
        nextRungCriteria: [
          "Hard ceiling — money/safety/contract actions stay human-approved.",
          "This kind can never reach an auto rung (gated by decide()).",
        ],
      };
    }
    // non-gated, at REVIEW_LIGHT: AUTO_BOUNDED is defined but disabled this story.
    return {
      nextRung: null,
      cappedBy: "ceiling",
      nextRungCriteria: [
        "AUTO_BOUNDED is defined but disabled (build only Record — no autonomy granted).",
      ],
    };
  }

  // Below the ceiling — the next rung is one step up, list the unmet criteria.
  const next = RUNG_ORDER[rank(rung) + 1]!;
  const req =
    next === "REVIEW_LIGHT"
      ? TRUST_THRESHOLDS.REVIEW_LIGHT
      : TRUST_THRESHOLDS.RECOMMEND;
  const criteria: string[] = [];
  let cappedBy: CappedBy = null;
  if (m.volume < req.minVolume) {
    criteria.push(
      `Reach ${req.minVolume} decided proposals (now ${m.volume}).`,
    );
    cappedBy ??= "volume";
  }
  if (m.approvalRate < req.minApproval) {
    criteria.push(
      `Lift approval to ${pct(req.minApproval)} (now ${pct(m.approvalRate)}).`,
    );
    cappedBy ??= "approval";
  }
  if (m.overrideRate > req.maxOverride) {
    criteria.push(
      `Cut overrides to ≤${pct(req.maxOverride)} (now ${pct(m.overrideRate)}).`,
    );
    cappedBy ??= "override";
  }
  if (m.overconfident) {
    criteria.push(
      `Calibrate confidence — states ${m.avgStatedConfidence != null ? m.avgStatedConfidence.toFixed(2) : "—"} but approved ${pct(m.approvalRate)} (over-confident).`,
    );
    cappedBy ??= "calibration";
  }
  if (criteria.length === 0) {
    // Meets everything for the next rung but it's not the computed rung — only when
    // that next rung is gated-blocked (handled above). Defensive: treat as ceiling.
    criteria.push("Meets the bar for the next rung.");
  }
  return { nextRung: next, nextRungCriteria: criteria, cappedBy };
}
