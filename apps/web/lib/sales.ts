import { dbForOrg, paginateArgs, pageResult } from "@axona/db";
import type { DealStage, Feasibility } from "@axona/db";
import { getFulfillmentData } from "./fulfillment";
import { getManufacturingData } from "./manufacturing";

// SALES.1 — Sales & CRM read/API layer (build-spec §4.14). Enterprise capital-
// equipment selling with ops feasibility. Read-only over the existing Deal model
// (no schema change): the pipeline funnel + weighted forecast, plus each deal's
// DELIVERABILITY badge — the cross-module check of whether ops can build+deliver
// by closeDate, derived by joining FULFILLMENT (FUL.1) + MANUFACTURING (MFG.1).
// Org-scoped via dbForOrg; the deal list paginated with the FND.11 helpers.
//
// Through-line: the BMW deal resolves AT_RISK through the read models — a
// Fulfillment hold (DLV-3312 EAR99) + a Manufacturing hold (HX2-0208 at Test,
// ECO-318/lot-88421) → +3w slip. The badge is derived, never a hardcoded string.
//
// MOAT / gating: CPQ config, contracts, and forecast commits are agent-DRAFTED/
// proposed only. /// RBAC.4: the quote/contract approval state machine.
/// AUDIT.3: each proposal logs inputs·output·model·confidence·approver. Do not
/// add those columns here.

const DEAL_CAP = 500;
const HELD = new Set(["HOLD", "HALT", "HALTED", "BLOCKED"]);
const STAGE_ORDER: DealStage[] = [
  "QUALIFY",
  "DEMO",
  "PROPOSAL",
  "NEGOTIATION",
  "COMMIT",
];
// Stage win-probabilities for the weighted forecast (capital-equipment funnel).
const STAGE_PROB: Record<DealStage, number> = {
  QUALIFY: 0.1,
  DEMO: 0.25,
  PROPOSAL: 0.5,
  NEGOTIATION: 0.7,
  COMMIT: 0.9,
};

export type Deliverability = Feasibility; // ON_TIME / AT_RISK / NOT_CHECKED

export interface SalesDeal {
  id: string;
  account: string;
  config: string;
  value: number;
  stage: DealStage;
  closeDate: Date | null;
  feasibility: Feasibility; // stored (agent-checked) estimate
  deliverability: Deliverability; // DERIVED over FUL + MFG (the real ops check)
  deliverabilityReason: string | null;
  weightedValue: number; // value × stage probability
}
export interface StageCount {
  stage: DealStage;
  count: number;
  value: number;
}
export interface SpreadCount {
  key: string;
  count: number;
}
export interface SalesRollup {
  funnel: StageCount[]; // all 5 stages, 0 where empty
  pipelineValue: number;
  weightedForecast: number; // Σ value × stage-probability
  deliverabilitySpread: SpreadCount[];
  atRisk: number; // deals with derived deliverability AT_RISK
}
export interface SalesData {
  deals: SalesDeal[];
  rollup: SalesRollup;
}

const DEAL_SELECT = {
  id: true,
  account: true,
  config: true,
  value: true,
  stage: true,
  closeDate: true,
  feasibility: true,
} as const;

const productOf = (config: string) => config.trim().split(/\s+/)[0] ?? config;

function countBy<T>(items: T[], key: (t: T) => string) {
  const m = new Map<string, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return [...m.entries()];
}

/**
 * Everything the Sales & CRM screen (SALES.2) needs, org-scoped and read-only:
 * the pipeline funnel + weighted Q3 forecast, and each deal's deliverability
 * badge derived over FUL.1 + MFG.1 (BMW resolves AT_RISK through the DLV-3312
 * hold + the HX2-0208 line hold), plus a rollup.
 */
export async function getSalesData(orgId: string): Promise<SalesData> {
  // Reuse the sibling read models rather than re-deriving ops feasibility.
  const [dealRows, ful, mfg] = await Promise.all([
    dbForOrg(orgId).deal.findMany({
      orderBy: [{ stage: "desc" }, { value: "desc" }],
      take: DEAL_CAP,
      select: DEAL_SELECT,
    }),
    getFulfillmentData(orgId),
    getManufacturingData(orgId),
  ]);

  // A line hold on a product (from Manufacturing) — context for a deal's slip.
  const heldProducts = new Set(
    mfg.lineFlow.flatMap((s) =>
      s.workOrders
        .filter((w) => HELD.has(w.status.toUpperCase()))
        .map((w) => w.product),
    ),
  );

  const deals: SalesDeal[] = dealRows.map((deal) => {
    const product = productOf(deal.config);
    // Deliverability keys on Fulfillment for the deal's account; if ops hasn't
    // committed a delivery yet, fall back to the stored agent-checked estimate.
    const acctDeliveries = ful.deliveries.filter(
      (d) => d.account === deal.account,
    );
    const risky = acctDeliveries.filter((d) => d.atRisk || d.late);
    const productHeld = heldProducts.has(product);

    // The deal-specific ops signal is the account's own delivery (FUL); a line
    // hold on the product (MFG) enriches the reason but doesn't flip an unrelated
    // account on its own.
    let deliverability: Deliverability;
    let deliverabilityReason: string | null = null;
    if (acctDeliveries.length === 0) {
      deliverability = deal.feasibility; // no ops commitment yet
    } else if (risky.length > 0) {
      deliverability = "AT_RISK";
      const bits = [`${risky[0]!.code} ${risky[0]!.riskState}`];
      if (productHeld) bits.push(`${product} line hold`);
      deliverabilityReason = bits.join(" · ");
    } else {
      deliverability = "ON_TIME";
      deliverabilityReason = "ops confirmed";
    }

    return {
      ...deal,
      deliverability,
      deliverabilityReason,
      weightedValue: Math.round(deal.value * STAGE_PROB[deal.stage]),
    };
  });

  // Funnel — all 5 stages in order, count + value.
  const funnel: StageCount[] = STAGE_ORDER.map((stage) => {
    const inStage = deals.filter((d) => d.stage === stage);
    return {
      stage,
      count: inStage.length,
      value: inStage.reduce((n, d) => n + d.value, 0),
    };
  });

  return {
    deals,
    rollup: {
      funnel,
      pipelineValue: deals.reduce((n, d) => n + d.value, 0),
      weightedForecast: deals.reduce((n, d) => n + d.weightedValue, 0),
      deliverabilitySpread: countBy(deals, (d) => d.deliverability)
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count),
      atRisk: deals.filter((d) => d.deliverability === "AT_RISK").length,
    },
  };
}

/** Paginated deal list (read-only), optionally filtered by stage. */
export async function listDeals(
  orgId: string,
  opts: { stage?: string; cursor?: string; take?: number } = {},
) {
  const take = opts.take ?? 50;
  const rows = await dbForOrg(orgId).deal.findMany({
    where: opts.stage ? { stage: opts.stage as DealStage } : {},
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: DEAL_SELECT,
  });
  const { items, nextCursor } = pageResult(rows, take);
  return {
    items: items.map((d) => ({
      ...d,
      weightedValue: Math.round(d.value * STAGE_PROB[d.stage]),
    })),
    nextCursor,
  };
}
