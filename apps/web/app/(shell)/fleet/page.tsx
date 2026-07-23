import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { getFleetData } from "@/lib/fleet";
import { resolveConfigSummaries } from "@/lib/units";
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
  configBySerial: {},
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

    // PLM.V4 — config version + sw version RESOLVED from the Unit spine (not the
    // stored Robot.firmware scalar), keyed by serial for the live-units table.
    const configMap = await resolveConfigSummaries(
      user.orgId,
      fleet.robots.map((r) => r.serial),
    );
    const configBySerial = Object.fromEntries(configMap);

    const traceLines = Array.isArray(latestRun?.trace)
      ? (latestRun.trace as { ts?: string; kind?: string; text?: string }[])
      : [];

    return <FleetView data={{ ...fleet, configBySerial, traceLines }} />;
  } catch {
    return <FleetView data={EMPTY} error />;
  }
}
