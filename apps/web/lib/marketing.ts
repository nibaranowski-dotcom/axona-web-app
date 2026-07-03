import { dbForOrg, paginateArgs, pageResult } from "@axona/db";
import { getSalesData } from "./sales";

// MKT.1 — Marketing read/API layer (build-spec §4.15). Demand-gen feeding Sales.
// Read-only over the existing Campaign model (no schema change): the demand funnel
// + pipeline-by-channel attribution (events dominant) + the campaign ROI table,
// with the underperforming paid campaign flagged. Org-scoped via dbForOrg; the
// campaign list paginated with the FND.11 helpers.
//
// Cross-module tie: campaign-sourced pipeline reconciles to the SALES.1 read model
// (getSalesData) — the funnel's SQL/pipeline stages + the attribution coverage are
// resolved through Sales, not hardcoded.
//
// MOAT / gating: budget reallocation + SQL hand-off to Sales are agent-DRAFTED/
// proposed only. /// RBAC.4: the reallocation/hand-off approval state machine.
/// AUDIT.3: each proposal logs inputs·output·model·confidence·approver. Do not
/// add those columns here.

const CAMPAIGN_CAP = 500;
// No lead model → leads are estimated from MQLs via a standard top-of-funnel rate
// (flagged; see MKT.1 notes). Not a fabricated business metric — a labelled derive.
const LEAD_TO_MQL_RATE = 0.35;
const UNDERPERFORMING_ROI = 1.0;

export interface MarketingCampaign {
  id: string;
  name: string;
  channel: string;
  mqls: number;
  pipeline: number;
  roi: number;
  status: string;
  underperforming: boolean; // status UNDERPERFORMING or roi < threshold
}
export interface ChannelAttribution {
  channel: string;
  campaigns: number;
  mqls: number;
  pipeline: number;
  pctOfPipeline: number;
  dominant: boolean;
}
export interface DemandFunnel {
  leads: number; // derived from MQLs (no lead model)
  mql: number; // Σ campaign MQLs
  sql: number; // handed-off SQLs → Sales deals (from SALES.1)
  pipeline: number; // Sales pipeline (from SALES.1)
}
export interface MarketingRollup {
  funnel: DemandFunnel;
  attribution: ChannelAttribution[]; // by channel, events dominant
  sourcedPipeline: number; // Σ campaign pipeline (marketing-attributed)
  salesPipeline: number; // total Sales pipeline (the tie)
  attributionCoveragePct: number; // sourced / sales pipeline
  underperforming: number; // count of flagged campaigns
}
export interface MarketingData {
  campaigns: MarketingCampaign[];
  rollup: MarketingRollup;
}

const CAMPAIGN_SELECT = {
  id: true,
  name: true,
  channel: true,
  mqls: true,
  pipeline: true,
  roi: true,
  status: true,
} as const;

const isUnderperforming = (c: { status: string; roi: number }) =>
  c.status.toUpperCase().includes("UNDERPERFORM") ||
  c.roi < UNDERPERFORMING_ROI;

/**
 * Everything the Marketing screen (MKT.2) needs, org-scoped and read-only: the
 * demand funnel (leads→MQL→SQL→pipeline, with SQL/pipeline reconciled to SALES.1),
 * the pipeline-by-channel attribution (events dominant), the campaign ROI table
 * (the underperforming paid campaign flagged), and a rollup.
 */
export async function getMarketingData(orgId: string): Promise<MarketingData> {
  // Reuse the Sales read model for the funnel + attribution tie, don't re-derive.
  const [campaignRows, sales] = await Promise.all([
    dbForOrg(orgId).campaign.findMany({
      orderBy: [{ pipeline: "desc" }, { name: "asc" }],
      take: CAMPAIGN_CAP,
      select: CAMPAIGN_SELECT,
    }),
    getSalesData(orgId),
  ]);

  const campaigns: MarketingCampaign[] = campaignRows.map((c) => ({
    ...c,
    underperforming: isUnderperforming(c),
  }));

  // Pipeline-by-channel attribution.
  const sourcedPipeline = campaigns.reduce((n, c) => n + c.pipeline, 0);
  const byChannel = new Map<
    string,
    { campaigns: number; mqls: number; pipeline: number }
  >();
  for (const c of campaigns) {
    const e = byChannel.get(c.channel) ?? {
      campaigns: 0,
      mqls: 0,
      pipeline: 0,
    };
    e.campaigns += 1;
    e.mqls += c.mqls;
    e.pipeline += c.pipeline;
    byChannel.set(c.channel, e);
  }
  const ranked = [...byChannel.entries()].sort(
    (a, b) => b[1].pipeline - a[1].pipeline,
  );
  const topChannel = ranked[0]?.[0] ?? null;
  const attribution: ChannelAttribution[] = ranked.map(([channel, v]) => ({
    channel,
    campaigns: v.campaigns,
    mqls: v.mqls,
    pipeline: v.pipeline,
    pctOfPipeline: sourcedPipeline
      ? Math.round((v.pipeline / sourcedPipeline) * 100)
      : 0,
    dominant: channel === topChannel,
  }));

  // Demand funnel — MQLs from marketing, SQL/pipeline reconciled to Sales.
  const mql = campaigns.reduce((n, c) => n + c.mqls, 0);
  const funnel: DemandFunnel = {
    leads: Math.round(mql / LEAD_TO_MQL_RATE),
    mql,
    sql: sales.deals.length,
    pipeline: sales.rollup.pipelineValue,
  };

  return {
    campaigns,
    rollup: {
      funnel,
      attribution,
      sourcedPipeline,
      salesPipeline: sales.rollup.pipelineValue,
      attributionCoveragePct: sales.rollup.pipelineValue
        ? Math.round((sourcedPipeline / sales.rollup.pipelineValue) * 100)
        : 0,
      underperforming: campaigns.filter((c) => c.underperforming).length,
    },
  };
}

/** Paginated campaign list (read-only), optionally filtered by channel. */
export async function listCampaigns(
  orgId: string,
  opts: { channel?: string; cursor?: string; take?: number } = {},
) {
  const take = opts.take ?? 50;
  const rows = await dbForOrg(orgId).campaign.findMany({
    where: opts.channel ? { channel: opts.channel } : {},
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: CAMPAIGN_SELECT,
  });
  const { items, nextCursor } = pageResult(rows, take);
  return {
    items: items.map((c) => ({ ...c, underperforming: isUnderperforming(c) })),
    nextCursor,
  };
}
