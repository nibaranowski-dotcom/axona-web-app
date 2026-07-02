import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { getFulfillmentData } from "@/lib/fulfillment";
import {
  FulfillmentView,
  type FulfillmentScreenData,
} from "@/components/fulfillment/FulfillmentView";

// /fulfillment (build-spec §4.12) — the delivery-pipeline screen. Read-only, data
// from FUL.1 getFulfillmentData (org-scoped). Static shell route → precedence
// over (shell)/[module].
export const dynamic = "force-dynamic";

const EMPTY: FulfillmentScreenData = {
  deliveries: [],
  pipeline: [],
  holds: [],
  traceLines: [],
};

export default async function FulfillmentPage() {
  const user = await getCurrentUser();
  if (!user) return <FulfillmentView data={EMPTY} />;

  try {
    const db = dbForOrg(user.orgId);
    const [fulfillment, latestRun] = await Promise.all([
      getFulfillmentData(user.orgId),
      db.agentRun.findFirst({
        where: { agent: { moduleKey: "fulfillment", orgId: user.orgId } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const traceLines = Array.isArray(latestRun?.trace)
      ? (latestRun.trace as { ts?: string; kind?: string; text?: string }[])
      : [];

    return <FulfillmentView data={{ ...fulfillment, traceLines }} />;
  } catch {
    return <FulfillmentView data={EMPTY} error />;
  }
}
