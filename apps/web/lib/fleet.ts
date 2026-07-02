import { dbForOrg, paginateArgs, pageResult } from "@axona/db";

// FLEET.1 — Fleet read/API layer (build-spec §4.16, §6). Read-only over the
// existing Robot / TelemetryPoint models: no schema change, no mutations (the
// map/telemetry screen is FLEET.2). Org-scoped via dbForOrg; lists paginated with
// the FND.11 helpers; telemetry is windowed by order + cap (no raw needed at this
// scale). Continues the narrative: SN-2196 thermal → hands to Field Service.

const ROBOT_CAP = 200;
const TELEMETRY_CAP = 1000;
const ALERT_STATUSES = new Set(["WATCH", "FAULT"]);

function isAlert(status: string): boolean {
  return ALERT_STATUSES.has(status.toUpperCase());
}

export interface FleetRobot {
  id: string;
  serial: string;
  model: string;
  customer: string;
  site: string;
  uptimePct: number;
  firmware: string;
  status: string;
  lat: number | null;
  lng: number | null;
  alert: boolean; // WATCH / FAULT → predictive-alert / Field Service hand-off
}
export interface TelemetrySample {
  ts: Date;
  metric: string;
  value: number;
}
export interface RobotTelemetry {
  robotId: string;
  serial: string;
  metric: string;
  points: TelemetrySample[]; // ordered oldest → newest
}
export interface StatusCount {
  status: string;
  count: number;
}
export interface FirmwareCount {
  version: string;
  count: number;
}
export interface FleetRollup {
  total: number;
  avgUptimePct: number;
  byStatus: StatusCount[];
  firmware: FirmwareCount[]; // OTA versions across the fleet
}
export interface FleetAlert {
  id: string;
  serial: string;
  customer: string;
  site: string;
  status: string;
  reason: string; // latest telemetry signal (e.g. battery_temp_c 50)
}
export interface FleetData {
  robots: FleetRobot[];
  telemetry: RobotTelemetry[];
  rollup: FleetRollup;
  alerts: FleetAlert[];
}

/**
 * Everything the Fleet map/telemetry screen (FLEET.2) needs, org-scoped and
 * read-only: every deployed robot (SN-2196 HX-2 BMW Site-3 WATCH), recent
 * telemetry series per robot+metric (SN-2196 thermal climb), a fleet rollup (avg
 * uptime, counts by status, OTA firmware spread), and the predictive-alert list
 * (WATCH/FAULT → hand off to Field Service).
 */
export async function getFleetData(orgId: string): Promise<FleetData> {
  const db = dbForOrg(orgId);

  const [robotRows, teleRows] = await Promise.all([
    db.robot.findMany({
      orderBy: { serial: "asc" },
      take: ROBOT_CAP,
      select: {
        id: true,
        serial: true,
        model: true,
        customer: true,
        site: true,
        uptimePct: true,
        firmware: true,
        status: true,
        lat: true,
        lng: true,
      },
    }),
    db.telemetryPoint.findMany({
      orderBy: { ts: "desc" }, // newest first → window + latest lookups
      take: TELEMETRY_CAP,
      select: { robotId: true, ts: true, metric: true, value: true },
    }),
  ]);

  const robots: FleetRobot[] = robotRows.map((r) => ({
    ...r,
    alert: isAlert(r.status),
  }));
  const serialById = new Map(robotRows.map((r) => [r.id, r.serial]));

  // Group telemetry by robot + metric (points ordered oldest → newest for charts).
  const teleMap = new Map<string, RobotTelemetry>();
  for (const t of teleRows) {
    const key = `${t.robotId}|${t.metric}`;
    let series = teleMap.get(key);
    if (!series) {
      series = {
        robotId: t.robotId,
        serial: serialById.get(t.robotId) ?? "",
        metric: t.metric,
        points: [],
      };
      teleMap.set(key, series);
    }
    series.points.push({ ts: t.ts, metric: t.metric, value: t.value });
  }
  const telemetry = [...teleMap.values()].map((s) => ({
    ...s,
    points: [...s.points].sort((a, b) => a.ts.getTime() - b.ts.getTime()),
  }));

  // Rollup.
  const total = robots.length;
  const avgUptimePct = total
    ? Math.round((robots.reduce((s, r) => s + r.uptimePct, 0) / total) * 10) /
      10
    : 0;
  const statusMap = new Map<string, number>();
  const fwMap = new Map<string, number>();
  for (const r of robots) {
    statusMap.set(r.status, (statusMap.get(r.status) ?? 0) + 1);
    fwMap.set(r.firmware, (fwMap.get(r.firmware) ?? 0) + 1);
  }
  const byStatus: StatusCount[] = [...statusMap]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
  const firmware: FirmwareCount[] = [...fwMap]
    .map(([version, count]) => ({ version, count }))
    .sort((a, b) => (a.version < b.version ? 1 : -1)); // newest first

  // Predictive alerts (WATCH/FAULT → Field Service hand-off) with the latest signal.
  const latestByRobot = new Map<string, { metric: string; value: number }>();
  for (const t of teleRows) {
    if (!latestByRobot.has(t.robotId))
      latestByRobot.set(t.robotId, { metric: t.metric, value: t.value }); // teleRows are desc → first seen is latest
  }
  const alerts: FleetAlert[] = robots
    .filter((r) => r.alert)
    .map((r) => {
      const last = latestByRobot.get(r.id);
      return {
        id: r.id,
        serial: r.serial,
        customer: r.customer,
        site: r.site,
        status: r.status,
        reason: last ? `${last.metric} ${last.value}` : `status ${r.status}`,
      };
    });

  return {
    robots,
    telemetry,
    rollup: { total, avgUptimePct, byStatus, firmware },
    alerts,
  };
}

/** Paginated robot list (read-only), optionally filtered by status. */
export async function listRobots(
  orgId: string,
  opts: { status?: string; cursor?: string; take?: number } = {},
) {
  const take = opts.take ?? 50;
  const rows = await dbForOrg(orgId).robot.findMany({
    where: opts.status ? { status: opts.status } : {},
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: {
      id: true,
      serial: true,
      model: true,
      customer: true,
      site: true,
      uptimePct: true,
      firmware: true,
      status: true,
      lat: true,
      lng: true,
    },
  });
  const { items, nextCursor } = pageResult(rows, take);
  return {
    items: items.map((r) => ({ ...r, alert: isAlert(r.status) })),
    nextCursor,
  };
}

/** Paginated telemetry list (read-only), optionally filtered by robotId. */
export async function listTelemetry(
  orgId: string,
  opts: { robotId?: string; cursor?: string; take?: number } = {},
) {
  const take = opts.take ?? 100;
  const rows = await dbForOrg(orgId).telemetryPoint.findMany({
    where: opts.robotId ? { robotId: opts.robotId } : {},
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: { id: true, robotId: true, ts: true, metric: true, value: true },
  });
  return pageResult(rows, take);
}
