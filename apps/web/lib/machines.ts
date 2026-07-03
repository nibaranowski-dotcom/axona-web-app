import { dbForOrg, paginateArgs, pageResult } from "@axona/db";
import type { HealthLevel, MachineKind, MachineStatus } from "@axona/db";

// MACH.1 — Machines read model (build-spec §4.9). The plant & equipment register.
// Read-only over the existing Machine + MachineSignal models (FND.8): no schema
// change. Groups Fixed vs Mobile; per machine surfaces status / utilization /
// health / telemetry + the latest signal, with a derived needs-service flag.
// Org-scoped via dbForOrg; the list paginated with the FND.11 helpers.
//
// MOAT / gating: any service / PM action is agent-DRAFTED/proposed only.
/// RBAC.4: the maintenance-scheduling approval state machine.
/// AUDIT.3: each proposal logs inputs·output·model·confidence·approver. Do not
/// add those columns here.

const MACHINE_CAP = 500;

export interface MachineSignalPoint {
  metric: string;
  value: number;
  ts: Date;
}
export interface MachineRow {
  id: string;
  assetId: string;
  name: string;
  kind: MachineKind;
  category: string;
  location: string;
  status: MachineStatus;
  utilization: number;
  health: string;
  healthLevel: HealthLevel;
  telemetryOnline: boolean;
  needsService: boolean; // derived from healthLevel / status
  latestSignal: MachineSignalPoint | null;
}
export interface MachineGroup {
  kind: MachineKind;
  label: string;
  machines: MachineRow[];
}
export interface MachinesRollup {
  total: number;
  byStatus: { status: MachineStatus; count: number }[];
  running: number;
  maintenance: number;
  idle: number;
  needsService: number;
  avgUtilization: number;
  telemetryOnline: number;
}
export interface MachinesData {
  groups: MachineGroup[];
  rollup: MachinesRollup;
}

const MACHINE_SELECT = {
  id: true,
  assetId: true,
  name: true,
  kind: true,
  category: true,
  location: true,
  status: true,
  utilization: true,
  health: true,
  healthLevel: true,
  telemetryOnline: true,
} as const;

const GROUP_LABEL: Record<MachineKind, string> = {
  FIXED: "Fixed plant",
  MOBILE: "Mobile units",
};

// Needs service = attention required: health watch/bad, or a fault.
export const needsService = (m: {
  healthLevel: HealthLevel;
  status: MachineStatus;
}) =>
  m.healthLevel === "WATCH" || m.healthLevel === "BAD" || m.status === "FAULT";

function shape(m: {
  id: string;
  assetId: string;
  name: string;
  kind: MachineKind;
  category: string;
  location: string;
  status: MachineStatus;
  utilization: number;
  health: string;
  healthLevel: HealthLevel;
  telemetryOnline: boolean;
  signals?: { metric: string; value: number; ts: Date }[];
}): MachineRow {
  return {
    id: m.id,
    assetId: m.assetId,
    name: m.name,
    kind: m.kind,
    category: m.category,
    location: m.location,
    status: m.status,
    utilization: m.utilization,
    health: m.health,
    healthLevel: m.healthLevel,
    telemetryOnline: m.telemetryOnline,
    needsService: needsService(m),
    latestSignal: m.signals?.[0] ?? null,
  };
}

/**
 * The machines register (MACH.1 screen): machines grouped Fixed vs Mobile, each
 * with status / utilization / health / telemetry + the latest signal and a
 * derived needs-service flag, plus a rollup. Org-scoped and read-only.
 */
export async function getMachinesData(orgId: string): Promise<MachinesData> {
  const rows = await dbForOrg(orgId).machine.findMany({
    orderBy: [{ kind: "asc" }, { assetId: "asc" }],
    take: MACHINE_CAP,
    select: {
      ...MACHINE_SELECT,
      signals: {
        orderBy: { ts: "desc" },
        take: 1,
        select: { metric: true, value: true, ts: true },
      },
    },
  });
  const machines = rows.map(shape);

  const kinds: MachineKind[] = ["FIXED", "MOBILE"];
  const groups: MachineGroup[] = kinds
    .map((kind) => ({
      kind,
      label: GROUP_LABEL[kind],
      machines: machines.filter((m) => m.kind === kind),
    }))
    .filter((g) => g.machines.length > 0);

  const byStatusMap = new Map<MachineStatus, number>();
  for (const m of machines)
    byStatusMap.set(m.status, (byStatusMap.get(m.status) ?? 0) + 1);
  const byStatus = [...byStatusMap.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
  const countStatus = (s: MachineStatus) => byStatusMap.get(s) ?? 0;

  const avgUtilization = machines.length
    ? Math.round(
        machines.reduce((n, m) => n + m.utilization, 0) / machines.length,
      )
    : 0;

  return {
    groups,
    rollup: {
      total: machines.length,
      byStatus,
      running: countStatus("RUNNING"),
      maintenance: countStatus("MAINTENANCE"),
      idle: countStatus("IDLE"),
      needsService: machines.filter((m) => m.needsService).length,
      avgUtilization,
      telemetryOnline: machines.filter((m) => m.telemetryOnline).length,
    },
  };
}

/** Paginated machine list (read-only), optionally filtered by kind / status. */
export async function listMachines(
  orgId: string,
  opts: {
    kind?: string;
    status?: string;
    cursor?: string;
    take?: number;
  } = {},
) {
  const take = opts.take ?? 50;
  const rows = await dbForOrg(orgId).machine.findMany({
    where: {
      ...(opts.kind ? { kind: opts.kind as MachineKind } : {}),
      ...(opts.status ? { status: opts.status as MachineStatus } : {}),
    },
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: MACHINE_SELECT,
  });
  const { items, nextCursor } = pageResult(rows, take);
  return { items: items.map(shape), nextCursor };
}
