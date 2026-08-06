import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { getFocusedRecord } from "@/lib/connected-objects";
import { FocusedRecord } from "@/components/ontology/FocusedRecord";
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

export default async function FulfillmentPage({
  searchParams,
}: {
  searchParams?: { focus?: string | string[] };
}) {
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

    // LINK.2 — a LINK.1 hop into this screen arrives with ?focus=<code>; resolve it

    // so the row is surfaced instead of the visitor landing on a bare list.

    const focused = await getFocusedRecord(
      user.orgId,

      "DELIVERY",

      searchParams?.focus,

      async (code) => {
        const r = await db.delivery.findFirst({
          where: { code },
          select: { account: true, stage: true },
        });

        return r ? `${r.stage} · ${r.account}` : null;
      },
    );

    return (
      <>
        {focused && (
          <FocusedRecord
            type={focused.type}
            code={focused.code}
            label={focused.label}
            groups={focused.groups}
            basePath="/fulfillment"
          />
        )}

        <FulfillmentView data={{ ...fulfillment, traceLines }} />
      </>
    );
  } catch {
    return <FulfillmentView data={EMPTY} error />;
  }
}
