import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { getFleetData } from "@/lib/fleet";
import { FleetView, type FleetScreenData } from "@/components/fleet/FleetView";

// /fleet (build-spec §4.16) — the Fleet map/telemetry screen. Read-only, data
// from FLEET.1 getFleetData (org-scoped). Static shell route → precedence over
// (shell)/[module].
export const dynamic = "force-dynamic";

const EMPTY: FleetScreenData = {
  robots: [],
  telemetry: [],
  rollup: { total: 0, avgUptimePct: 0, byStatus: [], firmware: [] },
  alerts: [],
  traceLines: [],
};

export default async function FleetPage() {
  const user = await getCurrentUser();
  if (!user) return <FleetView data={EMPTY} />;

  try {
    const db = dbForOrg(user.orgId);
    const [fleet, latestRun] = await Promise.all([
      getFleetData(user.orgId),
      db.agentRun.findFirst({
        where: { agent: { moduleKey: "fleet", orgId: user.orgId } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const traceLines = Array.isArray(latestRun?.trace)
      ? (latestRun.trace as { ts?: string; kind?: string; text?: string }[])
      : [];

    return <FleetView data={{ ...fleet, traceLines }} />;
  } catch {
    return <FleetView data={EMPTY} error />;
  }
}
