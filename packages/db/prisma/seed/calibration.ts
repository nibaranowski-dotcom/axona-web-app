import type { OrgScopedDb } from "../../src";

// CONF.1 — seed a decided-proposal HISTORY so the demo has real ground truth to
// calibrate from. Each sample is a REAL pair of audit entries, exactly as the app
// produces them: an AGENT proposal carrying a raw `confidence`, then a HUMAN
// decision via decide()'s convention (`${kind}.approve` / `${kind}.reject`) on the
// same target. calibrate() pairs them by target and fits the org's raw→calibrated
// map. Per-org — each org's history is its own (isolation).
//
// The demo org is seeded systematically OVER-confident (agents say ~0.9, humans
// approve ~60%) so calibration visibly corrects 0.9 → ~0.6. The isolation org gets
// a different (under-confident) pattern so the two models are demonstrably disjoint.

export interface CalBand {
  raw: number; // stated confidence for this band
  approvalRate: number; // observed human-approval rate
  count: number; // decided proposals in the band
}

const DAY = 86_400_000;

/** Seed `count` decided proposals per band. Returns the number of proposals seeded. */
export async function seedCalibrationHistory(
  db: OrgScopedDb,
  orgId: string,
  bands: CalBand[],
  opts: { prefix: string; startDaysAgo?: number; nowMs: number },
): Promise<number> {
  const start = opts.startDaysAgo ?? 55;
  let n = 0;
  for (const band of bands) {
    const approvals = Math.round(band.count * band.approvalRate);
    for (let i = 0; i < band.count; i++) {
      const approved = i < approvals;
      // small deterministic jitter so the band isn't a single point mass
      const raw = clamp01(band.raw + ((i % 5) - 2) * 0.008);
      const target = `${opts.prefix}-${String(n).padStart(3, "0")}`;
      const proposedAt = new Date(opts.nowMs - (start - n * 0.4) * DAY);
      const decidedAt = new Date(proposedAt.getTime() + 6 * 3_600_000);

      // 1) the AGENT proposal (carries the raw confidence)
      await db.auditLog.create({
        data: {
          orgId,
          actorType: "AGENT",
          actorId: null,
          actorLabel: "Sourcing agent",
          action: "po.draft",
          targetType: "PurchaseOrder",
          targetId: target,
          summary: `Drafted reorder ${target} — AWAITING_APPROVAL`,
          output: { status: "AWAITING_APPROVAL" } as never,
          model: "claude-sonnet-4-6",
          confidence: Math.round(raw * 100) / 100,
          createdAt: proposedAt,
        },
      });
      // 2) the HUMAN decision. Same `.approve` / `.reject` suffix decide() uses (so
      //    calibrate() pairs it), but a distinct `proposal.*` prefix so it isn't
      //    swept by verify scripts that clean their own `po.approve.%` test rows.
      await db.auditLog.create({
        data: {
          orgId,
          actorType: "HUMAN",
          actorId: null,
          actorLabel: "Operations approver",
          action: approved ? "proposal.approve" : "proposal.reject",
          targetType: "PurchaseOrder",
          targetId: target,
          summary: approved
            ? `${target} AWAITING_APPROVAL → APPROVED`
            : `${target} rejected at the approval gate`,
          output: { status: approved ? "APPROVED" : "REJECTED" } as never,
          approverId: null,
          approverLabel: "Operations approver",
          createdAt: decidedAt,
        },
      });
      n++;
    }
  }
  return n;
}

/** The demo org: systematically OVER-confident (calibration corrects 0.9 → ~0.6). */
export const DEMO_CALIBRATION: CalBand[] = [
  { raw: 0.9, approvalRate: 0.6, count: 20 },
  { raw: 0.7, approvalRate: 0.55, count: 11 },
  { raw: 0.5, approvalRate: 0.45, count: 11 },
];

/** The isolation org: UNDER-confident (0.5 → ~0.75) — a disjoint model. */
export const ISOLATION_CALIBRATION: CalBand[] = [
  { raw: 0.5, approvalRate: 0.75, count: 14 },
  { raw: 0.3, approvalRate: 0.55, count: 11 },
];

/**
 * DEMO.6 #4 — prospect demo tenants. Those orgs had ZERO CalibrationModel rows, so
 * `calibratedConfidence()` returned raw with state "uncalibrated" and the RCA screen
 * read "(uncal)" — the agent's headline number visibly untrusted.
 *
 * Mildly over-confident, and DELIBERATELY spread across the high band: the RCA
 * proposal's evidence-derived score lands high (a substituted part on a quarantined
 * lot, the lot spanning several units, a config delta, prior component failures and
 * recalled precedent all corroborate), so the top bin is where the correction has to
 * be real. 44 decided proposals — comfortably over MIN_SAMPLES (20), so the fit is a
 * genuine model and not a floor-scraping one.
 */
export const PROSPECT_CALIBRATION: CalBand[] = [
  { raw: 0.9, approvalRate: 0.7, count: 22 },
  { raw: 0.7, approvalRate: 0.6, count: 12 },
  { raw: 0.5, approvalRate: 0.45, count: 10 },
];

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
