import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { getMarketingData } from "@/lib/marketing";
import {
  MarketingView,
  type MarketingScreenData,
} from "@/components/marketing/MarketingView";

// /marketing (build-spec §4.15) — the demand funnel + pipeline-by-channel
// attribution + campaigns. Data from MKT.1 getMarketingData (org-scoped, attribution
// reconciled to SALES.1), read-only. Static shell route → precedence over
// (shell)/[module].
export const dynamic = "force-dynamic";

const EMPTY: MarketingScreenData = {
  campaigns: [],
  rollup: {
    funnel: { leads: 0, mql: 0, sql: 0, pipeline: 0 },
    attribution: [],
    sourcedPipeline: 0,
    salesPipeline: 0,
    attributionCoveragePct: 0,
    underperforming: 0,
  },
  traceLines: [],
};

export default async function MarketingPage() {
  const user = await getCurrentUser();
  if (!user) return <MarketingView data={EMPTY} />;

  try {
    const db = dbForOrg(user.orgId);
    const [marketing, latestRun] = await Promise.all([
      getMarketingData(user.orgId),
      db.agentRun.findFirst({
        where: { agent: { moduleKey: "marketing", orgId: user.orgId } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const traceLines = Array.isArray(latestRun?.trace)
      ? (latestRun.trace as { ts?: string; kind?: string; text?: string }[])
      : [];

    return <MarketingView data={{ ...marketing, traceLines }} />;
  } catch {
    return <MarketingView data={EMPTY} error />;
  }
}
