import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { getSalesData } from "@/lib/sales";
import { SalesView, type SalesScreenData } from "@/components/sales/SalesView";

// /sales (build-spec §4.14) — Sales & CRM: the pipeline funnel + Q3 forecast, and
// the top-deals table with the agent-checked deliverability badge (derived over
// FUL.1 + MFG.1). Data from SALES.1 getSalesData (org-scoped), read-only. Static
// shell route → precedence over (shell)/[module].
export const dynamic = "force-dynamic";

const EMPTY: SalesScreenData = {
  deals: [],
  rollup: {
    funnel: [],
    pipelineValue: 0,
    weightedForecast: 0,
    deliverabilitySpread: [],
    atRisk: 0,
  },
  traceLines: [],
};

export default async function SalesPage() {
  const user = await getCurrentUser();
  if (!user) return <SalesView data={EMPTY} />;

  try {
    const db = dbForOrg(user.orgId);
    const [sales, latestRun] = await Promise.all([
      getSalesData(user.orgId),
      db.agentRun.findFirst({
        where: { agent: { moduleKey: "sales", orgId: user.orgId } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const traceLines = Array.isArray(latestRun?.trace)
      ? (latestRun.trace as { ts?: string; kind?: string; text?: string }[])
      : [];

    return <SalesView data={{ ...sales, traceLines }} />;
  } catch {
    return <SalesView data={EMPTY} error />;
  }
}
