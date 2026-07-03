import { dbForOrg, paginateArgs, pageResult } from "@axona/db";

// MFG.1 — Manufacturing (MES) read/API layer (build-spec §4.11, §6). Read-only
// over the existing WorkOrderMfg model: no schema change, no mutations (the
// line-flow + genealogy screen is MFG.2). Org-scoped via dbForOrg; lists
// paginated with the FND.11 helpers.
//
// MOAT (capture fidelity caps the moat): WorkOrderMfg.serial is the as-built
// genealogy anchor — parts·serials·firmware are captured AS BUILT, never
// reconstructed. This layer exposes the serial → work-order station trace only.
/// The FULL as-built parts·serials·firmware genealogy GRAPH (SERVO-204/-205,
/// lot 88421, firmware) lands in ONT.2 — MFG.1 exposes the serial→work-order
/// trace; ONT.2 extends it. Do not reconstruct capture here.

const WO_CAP = 1000;
const GENEALOGY_CAP = 200;
const DONE = new Set(["DONE", "COMPLETE", "COMPLETED", "SHIPPED"]);
const IN_PROGRESS = new Set(["WIP", "IN_PROGRESS", "RUNNING", "STARTED"]);

// Canonical line-station build order. The model carries no order column, so the
// sequence is defined here (a modelling choice — flagged in the MFG.1 notes);
// unknown stations sort to the end, preserving insertion order.
const STATION_ORDER = [
  "Frame Build",
  "Drive Integration",
  "Final Assembly",
  "Test",
  "Pack-out",
];
const stationRank = (station: string) => {
  const i = STATION_ORDER.indexOf(station);
  return i === -1 ? STATION_ORDER.length : i;
};

export interface MfgWorkOrder {
  id: string;
  serial: string;
  product: string;
  station: string;
  status: string;
  startedAt: Date | null;
}
export interface LineStation {
  station: string;
  order: number;
  count: number;
  inProgress: number;
  workOrders: MfgWorkOrder[];
}
export interface GenealogyStep {
  id: string;
  serial: string;
  product: string;
  station: string;
  order: number;
  status: string;
  startedAt: Date | null;
}
export interface Throughput {
  built: number; // DONE
  inProgress: number; // WIP
  onHold: number;
  total: number;
  oeePct: number | null; // not derivable from the model — flagged null
}
export interface Bottleneck {
  station: string;
  inProgress: number;
}
export interface ManufacturingData {
  lineFlow: LineStation[];
  throughput: Throughput;
  bottlenecks: Bottleneck[];
}

const WO_SELECT = {
  id: true,
  serial: true,
  product: true,
  station: true,
  status: true,
  startedAt: true,
} as const;

const isDone = (s: string) => DONE.has(s.toUpperCase());
const isWip = (s: string) => IN_PROGRESS.has(s.toUpperCase());

/**
 * The MES line view (MFG.2): work orders grouped into line stations in build
 * order (the line-flow artifact), plant throughput, and the in-progress
 * bottlenecks. Org-scoped and read-only. For a single unit's build trace use
 * getGenealogy(orgId, serial).
 */
export async function getManufacturingData(
  orgId: string,
): Promise<ManufacturingData> {
  const rows = await dbForOrg(orgId).workOrderMfg.findMany({
    take: WO_CAP,
    orderBy: { startedAt: "asc" },
    select: WO_SELECT,
  });

  // Group into line stations, ordered by build sequence.
  const byStation = new Map<string, MfgWorkOrder[]>();
  for (const w of rows) {
    const list = byStation.get(w.station) ?? [];
    list.push(w);
    byStation.set(w.station, list);
  }
  const lineFlow: LineStation[] = [...byStation.entries()]
    .map(([station, workOrders]) => ({
      station,
      order: stationRank(station),
      count: workOrders.length,
      inProgress: workOrders.filter((w) => isWip(w.status)).length,
      workOrders,
    }))
    .sort((a, b) => a.order - b.order || a.station.localeCompare(b.station));

  const built = rows.filter((w) => isDone(w.status)).length;
  const inProgress = rows.filter((w) => isWip(w.status)).length;
  const onHold = rows.filter(
    (w) => !isDone(w.status) && !isWip(w.status),
  ).length;

  const bottlenecks: Bottleneck[] = lineFlow
    .filter((s) => s.inProgress > 0)
    .map((s) => ({ station: s.station, inProgress: s.inProgress }))
    .sort((a, b) => b.inProgress - a.inProgress);

  return {
    lineFlow,
    throughput: {
      built,
      inProgress,
      onHold,
      total: rows.length,
      oeePct: null, // no cycle-time / availability / quality feed in the model — flagged
    },
    bottlenecks,
  };
}

/**
 * A single unit's as-built trace — every WorkOrderMfg record for `serial` across
 * stations, ordered by build sequence. "Trace a robot serial's full build
 * history." (The parts·serials·firmware graph is ONT.2.)
 */
export async function getGenealogy(
  orgId: string,
  serial: string,
): Promise<{ serial: string; steps: GenealogyStep[] }> {
  const rows = await dbForOrg(orgId).workOrderMfg.findMany({
    where: { serial },
    take: GENEALOGY_CAP,
    select: WO_SELECT,
  });
  const steps: GenealogyStep[] = rows
    .map((w) => ({
      id: w.id,
      serial: w.serial,
      product: w.product,
      station: w.station,
      order: stationRank(w.station),
      status: w.status,
      startedAt: w.startedAt,
    }))
    .sort(
      (a, b) =>
        a.order - b.order ||
        (a.startedAt?.getTime() ?? 0) - (b.startedAt?.getTime() ?? 0),
    );
  return { serial, steps };
}

/** Paginated work-order list (read-only), optionally filtered by station. */
export async function listWorkOrders(
  orgId: string,
  opts: { station?: string; cursor?: string; take?: number } = {},
) {
  const take = opts.take ?? 100;
  const rows = await dbForOrg(orgId).workOrderMfg.findMany({
    where: opts.station ? { station: opts.station } : {},
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: WO_SELECT,
  });
  return pageResult(rows, take);
}
