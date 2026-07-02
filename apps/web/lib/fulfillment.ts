import { dbForOrg, paginateArgs, pageResult } from "@axona/db";
import type { DeliveryStage } from "@axona/db";

// FUL.1 — Fulfillment & Delivery read/API layer (build-spec §4.12, §6). Read-only
// over the existing Delivery model: no schema change, no mutations (the delivery-
// pipeline screen is FUL.2). Org-scoped via dbForOrg; lists paginated with the
// FND.11 helpers. Continues the narrative: ECO-318 → BMW order → DLV-3312 Osaka
// customs hold.

// The delivery pipeline, in order (ALLOC → … → ACTIVE).
export const DELIVERY_STAGES: readonly DeliveryStage[] = [
  "ALLOC",
  "CRATE",
  "FREIGHT",
  "CUSTOMS",
  "ONSITE",
  "COMMISSION",
  "ACTIVE",
];

export function parseDeliveryStage(
  v: string | null | undefined,
): DeliveryStage | undefined {
  return v && (DELIVERY_STAGES as readonly string[]).includes(v)
    ? (v as DeliveryStage)
    : undefined;
}

// A riskState is a real hold/risk unless empty or explicitly on-track.
function isAtRisk(riskState: string): boolean {
  const s = riskState.trim().toLowerCase();
  return s !== "" && s !== "on-track";
}

export interface Delivery {
  id: string;
  code: string;
  account: string;
  destination: string;
  units: string;
  stage: DeliveryStage;
  committedDate: Date;
  etaDate: Date;
  riskState: string;
  atRisk: boolean; // riskState is a real hold/risk
  late: boolean; // etaDate later than committedDate
}
export interface StageCount {
  stage: DeliveryStage;
  count: number;
}
export interface FulfillmentData {
  deliveries: Delivery[];
  pipeline: StageCount[]; // count per stage (all 7, 0 where empty)
  holds: Delivery[]; // the at-risk / hold list
}

function shape(r: {
  id: string;
  code: string;
  account: string;
  destination: string;
  units: string;
  stage: DeliveryStage;
  committedDate: Date;
  etaDate: Date;
  riskState: string;
}): Delivery {
  return {
    ...r,
    atRisk: isAtRisk(r.riskState),
    late: r.etaDate.getTime() > r.committedDate.getTime(),
  };
}

/**
 * Everything the delivery-pipeline screen (FUL.2) needs, org-scoped and
 * read-only: every delivery with its stage / committed-vs-eta / risk (DLV-3312
 * BMW Osaka EAR99 hold), a per-stage pipeline rollup (all 7 stages), and the
 * at-risk/hold list.
 */
export async function getFulfillmentData(
  orgId: string,
): Promise<FulfillmentData> {
  const rows = await dbForOrg(orgId).delivery.findMany({
    orderBy: { code: "desc" },
    take: 200,
    select: {
      id: true,
      code: true,
      account: true,
      destination: true,
      units: true,
      stage: true,
      committedDate: true,
      etaDate: true,
      riskState: true,
    },
  });

  const deliveries = rows.map(shape);
  const pipeline: StageCount[] = DELIVERY_STAGES.map((stage) => ({
    stage,
    count: deliveries.filter((d) => d.stage === stage).length,
  }));
  const holds = deliveries.filter((d) => d.atRisk);

  return { deliveries, pipeline, holds };
}

/** Paginated delivery list (read-only), optionally filtered by stage. */
export async function listDeliveries(
  orgId: string,
  opts: { stage?: string; cursor?: string; take?: number } = {},
) {
  const take = opts.take ?? 50;
  const stage = parseDeliveryStage(opts.stage);
  const rows = await dbForOrg(orgId).delivery.findMany({
    where: stage ? { stage } : {},
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: {
      id: true,
      code: true,
      account: true,
      destination: true,
      units: true,
      stage: true,
      committedDate: true,
      etaDate: true,
      riskState: true,
    },
  });
  const { items, nextCursor } = pageResult(rows, take);
  return { items: items.map(shape), nextCursor };
}
