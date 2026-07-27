import type { OrgScopedDb } from "../../src";

// TRUST.1 — seed a couple of DECIDED-PROPOSAL histories so the demo trust ladder tells
// the full story: a non-gated kind that CLIMBS to REVIEW_LIGHT, and a gated kind with an
// equally strong record that is CAPPED at RECOMMEND by the hard auto ceiling. (The third
// cell — the over-confident Sourcing agent on po.draft — comes free from the CONF.1
// calibration seed and lands at SUGGEST, capped by its own over-confidence.)
//
// These proposals carry NO confidence (confidence: null) on purpose: calibrate() only
// fits from proposals WITH a confidence, so this history feeds the trust ladder WITHOUT
// perturbing CONF.1's over-confident demo model. Same AUDIT.1 pairing convention the app
// produces (an AGENT proposal + a HUMAN ".approve"/".reject" on the same target).

const DAY = 86_400_000;

interface TrustSeedCell {
  agentLabel: string;
  /** The proposal verb = the cell's action-kind. */
  action: string;
  targetType: string;
  prefix: string;
  decided: number;
  approved: number;
}

/** Non-gated, strong record → REVIEW_LIGHT; gated, strong record → capped at RECOMMEND. */
const DEMO_TRUST_CELLS: TrustSeedCell[] = [
  {
    agentLabel: "Fulfillment planner",
    action: "delivery.schedule", // non-gated low-risk → ceiling REVIEW_LIGHT
    targetType: "Delivery",
    prefix: "trust-ful",
    decided: 30,
    approved: 27, // 90% approval, 10% override → REVIEW_LIGHT
  },
  {
    agentLabel: "Change-order agent",
    action: "eco.release", // gated (contract/safety) → hard ceiling RECOMMEND
    targetType: "ECO",
    prefix: "trust-eco",
    decided: 30,
    approved: 26, // 87% approval — would be REVIEW_LIGHT, but gated → RECOMMEND
  },
];

/** Seed the demo trust histories. Returns the number of decided proposals seeded. */
export async function seedTrustHistory(
  db: OrgScopedDb,
  orgId: string,
  nowMs: number,
): Promise<number> {
  let n = 0;
  for (const cell of DEMO_TRUST_CELLS) {
    for (let i = 0; i < cell.decided; i++) {
      const approved = i < cell.approved;
      const target = `${cell.prefix}-${String(i).padStart(3, "0")}`;
      const proposedAt = new Date(nowMs - (40 - i * 0.5) * DAY);
      const decidedAt = new Date(proposedAt.getTime() + 5 * 3_600_000);

      await db.auditLog.create({
        data: {
          orgId,
          actorType: "AGENT",
          actorId: null,
          actorLabel: cell.agentLabel,
          action: cell.action,
          targetType: cell.targetType,
          targetId: target,
          summary: `Proposed ${target}`,
          output: { status: "AWAITING_APPROVAL" } as never,
          model: "claude-sonnet-4-6",
          confidence: null, // NOT calibration fodder — keeps CONF.1's model untouched
          createdAt: proposedAt,
        },
      });
      await db.auditLog.create({
        data: {
          orgId,
          actorType: "HUMAN",
          actorId: null,
          actorLabel: "Operations approver",
          action: approved ? "proposal.approve" : "proposal.reject",
          targetType: cell.targetType,
          targetId: target,
          summary: approved
            ? `${target} approved`
            : `${target} rejected at the gate`,
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
