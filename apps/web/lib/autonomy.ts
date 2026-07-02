import { dbForOrg, paginateArgs, pageResult } from "@axona/db";
import type { Severity } from "@axona/db";

// AUTO.1 — Autonomy (Robotics Ops) read/API layer (build-spec §4.19, §6). Read-
// only over the existing AutonomyMetric / SafetyIncident / PolicyVersion models:
// no schema change, no mutations (the autonomy-rate + policy screen is AUTO.2).
// Org-scoped via dbForOrg; lists paginated with the FND.11 helpers. Continues the
// Site-3 thread: the p-13 canary regression (autonomy dips, takeovers spike).

const METRIC_CAP = 500;
const INCIDENT_CAP = 200;
const POLICY_CAP = 100;
const CLOSED = new Set(["CLOSED", "RESOLVED", "DONE"]);
// A regression is a MEANINGFUL move (not day-to-day noise): autonomy down > 1pt
// or takeovers/1k up > 1 across the window.
const REGRESSION_RATE_DROP = 1;
const REGRESSION_TAKEOVER_RISE = 1;

export interface AutonomyPoint {
  ts: Date;
  autonomyRate: number;
  takeoversPer1k: number;
  policyVersion: string;
}
export interface AutonomySeries {
  site: string;
  points: AutonomyPoint[]; // ordered oldest → newest
  regression: boolean; // autonomy declined or takeovers rose across the window
}
export interface SafetyIncident {
  id: string;
  code: string;
  type: string;
  robotSerial: string;
  site: string;
  severity: Severity;
  status: string;
}
export interface PolicyVersion {
  id: string;
  version: string;
  note: string;
  state: string; // current / canary / standby
}
export interface AutonomyRollup {
  avgAutonomyRate: number; // mean of the latest point per site
  avgTakeoversPer1k: number;
  openIncidents: number;
  canaryVersion: string | null; // the policy in canary (p-13)
}
export interface AutonomyData {
  autonomySeries: AutonomySeries[];
  safetyIncidents: SafetyIncident[];
  policyVersions: PolicyVersion[];
  rollup: AutonomyRollup;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Everything the Autonomy screen (AUTO.2) needs, org-scoped and read-only:
 * per-site autonomy series (Site-3 shows the p-13 canary regression — the rate
 * dips + takeovers spike after the p-13 policy), open safety incidents (INC-201
 * near-miss), the policy versions (p-13 canary + current/standby), and a rollup.
 */
export async function getAutonomyData(orgId: string): Promise<AutonomyData> {
  const db = dbForOrg(orgId);

  const [metricRows, incidentRows, policyRows] = await Promise.all([
    db.autonomyMetric.findMany({
      orderBy: [{ site: "asc" }, { ts: "asc" }],
      take: METRIC_CAP,
      select: {
        site: true,
        ts: true,
        autonomyRate: true,
        takeoversPer1k: true,
        policyVersion: true,
      },
    }),
    db.safetyIncident.findMany({
      orderBy: [{ severity: "desc" }, { code: "desc" }],
      take: INCIDENT_CAP,
      select: {
        id: true,
        code: true,
        type: true,
        robotSerial: true,
        site: true,
        severity: true,
        status: true,
      },
    }),
    db.policyVersion.findMany({
      orderBy: { version: "desc" },
      take: POLICY_CAP,
      select: { id: true, version: true, note: true, state: true },
    }),
  ]);

  // Group metrics into per-site series (already ts-ordered).
  const seriesMap = new Map<string, AutonomyPoint[]>();
  for (const m of metricRows) {
    const pts = seriesMap.get(m.site) ?? [];
    pts.push({
      ts: m.ts,
      autonomyRate: m.autonomyRate,
      takeoversPer1k: m.takeoversPer1k,
      policyVersion: m.policyVersion,
    });
    seriesMap.set(m.site, pts);
  }
  const autonomySeries: AutonomySeries[] = [...seriesMap.entries()].map(
    ([site, points]) => {
      const first = points[0];
      const last = points[points.length - 1];
      const regression =
        !!first &&
        !!last &&
        (first.autonomyRate - last.autonomyRate > REGRESSION_RATE_DROP ||
          last.takeoversPer1k - first.takeoversPer1k >
            REGRESSION_TAKEOVER_RISE);
      return { site, points, regression };
    },
  );

  // Rollup — from the latest point per site.
  const latest = autonomySeries
    .map((s) => s.points[s.points.length - 1])
    .filter((p): p is AutonomyPoint => !!p);
  const avgAutonomyRate = latest.length
    ? round1(latest.reduce((s, p) => s + p.autonomyRate, 0) / latest.length)
    : 0;
  const avgTakeoversPer1k = latest.length
    ? round1(latest.reduce((s, p) => s + p.takeoversPer1k, 0) / latest.length)
    : 0;
  const canaryVersion =
    policyRows.find((p) => p.state.toLowerCase() === "canary")?.version ?? null;

  const openIncidents = incidentRows.filter(
    (i) => !CLOSED.has(i.status.toUpperCase()),
  ).length;

  return {
    autonomySeries,
    safetyIncidents: incidentRows, // all logged (the table shows closed too)
    policyVersions: policyRows,
    rollup: {
      avgAutonomyRate,
      avgTakeoversPer1k,
      openIncidents,
      canaryVersion,
    },
  };
}

/** Paginated autonomy-metric list (read-only), optionally filtered by site. */
export async function listMetrics(
  orgId: string,
  opts: { site?: string; cursor?: string; take?: number } = {},
) {
  const take = opts.take ?? 100;
  const rows = await dbForOrg(orgId).autonomyMetric.findMany({
    where: opts.site ? { site: opts.site } : {},
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: {
      id: true,
      site: true,
      ts: true,
      autonomyRate: true,
      takeoversPer1k: true,
      policyVersion: true,
    },
  });
  return pageResult(rows, take);
}

/** Paginated safety-incident list (read-only), optionally filtered by status. */
export async function listIncidents(
  orgId: string,
  opts: { status?: string; cursor?: string; take?: number } = {},
) {
  const take = opts.take ?? 50;
  const rows = await dbForOrg(orgId).safetyIncident.findMany({
    where: opts.status ? { status: opts.status } : {},
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: {
      id: true,
      code: true,
      type: true,
      robotSerial: true,
      site: true,
      severity: true,
      status: true,
    },
  });
  return pageResult(rows, take);
}

/** Paginated policy-version list (read-only). */
export async function listPolicies(
  orgId: string,
  opts: { cursor?: string; take?: number } = {},
) {
  const take = opts.take ?? 50;
  const rows = await dbForOrg(orgId).policyVersion.findMany({
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: { id: true, version: true, note: true, state: true },
  });
  return pageResult(rows, take);
}
