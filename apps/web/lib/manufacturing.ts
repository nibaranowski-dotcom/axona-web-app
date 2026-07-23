import { dbForOrg, asBuiltDiff, paginateArgs, pageResult } from "@axona/db";

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
  "Actuators",
  "Firmware",
  "Test",
  "Pack-out",
];
/** The canonical line stations in build order (for the MFG.2 pipeline UI). */
export const LINE_STATIONS = STATION_ORDER;
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

  // A unit (serial) may carry multiple rows — its as-built history across
  // stations. The line-flow + throughput reflect each unit's CURRENT position
  // (its furthest station); the full per-serial history is getGenealogy. This
  // keeps completed units from appearing at every station they passed through.
  const currentBySerial = new Map<string, MfgWorkOrder>();
  for (const w of rows) {
    const cur = currentBySerial.get(w.serial);
    if (!cur || stationRank(w.station) > stationRank(cur.station)) {
      currentBySerial.set(w.serial, w);
    }
  }
  const current = [...currentBySerial.values()];
  const lastStation = STATION_ORDER[STATION_ORDER.length - 1];

  // Group current unit positions into line stations, ordered by build sequence.
  const byStation = new Map<string, MfgWorkOrder[]>();
  for (const w of current) {
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

  // Unit-level throughput: a unit is built once it completes the final station.
  const built = current.filter(
    (w) => w.station === lastStation && isDone(w.status),
  ).length;
  const inProgress = current.filter((w) => isWip(w.status)).length;
  const onHold = current.filter(
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
      total: current.length, // distinct units in build (not history rows)
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

// ── PLM.V3 · as-built capture (the build-time genealogy write) ───────────────
// The Manufacturing screen gains the capture step: components are scanned against
// the BOM at build, lots + revisions recorded, and the diff computed AT WRITE TIME
// (captureAsBuilt stores isSubstitution — never reconstructed). This read model
// assembles the capture card for the focused unit; the write is a gated action.

export interface CapturedComponent {
  position: string;
  partNumber: string;
  rev: string;
  lotCode: string | null;
  isSubstitution: boolean;
  captured: boolean;
}
export interface OpenPosition {
  position: string;
  partNumber: string;
  rev: string;
  partRevisionId: string;
}
export interface AsBuiltCapture {
  serial: string;
  bomRevision: string; // the as-designed BOM the capture diffs against
  scanned: number; // positions with an as-built record
  total: number; // BOM positions
  substitutions: number;
  lastCapturedAt: Date | null;
  components: CapturedComponent[]; // substitutions first (the story), then matches
  openPositions: OpenPosition[]; // BOM positions not yet captured (scan targets)
  asBuiltHref: string; // → PLM.4 full diff
}

/**
 * The as-built capture state for a single unit (PLM.V3). Reads the captured
 * records aligned to the BOM (asBuiltDiff), plus the as-designed part per open
 * position so a scan can be recorded. Org-scoped, read-only — the capture WRITE
 * is captureComponentAction (RBAC-gated + audited).
 */
export async function getAsBuiltCapture(
  orgId: string,
  serial: string,
): Promise<AsBuiltCapture | null> {
  const db = dbForOrg(orgId);
  const unit = await db.unit.findFirst({
    where: { serial },
    select: { id: true, serial: true, productModelId: true },
  });
  if (!unit) return null;

  const [diff, model, bom, lastRecord] = await Promise.all([
    asBuiltDiff(db, unit.id),
    db.productModel.findUnique({
      where: { id: unit.productModelId },
      select: { designRevision: true },
    }),
    db.bomLine.findMany({
      where: { productModelId: unit.productModelId },
      select: {
        position: true,
        partRevisionId: true,
        partRevision: {
          select: { rev: true, partMaster: { select: { partNumber: true } } },
        },
      },
    }),
    db.asBuiltRecord.findFirst({
      where: { unitId: unit.id },
      orderBy: { installedAt: "desc" },
      select: { installedAt: true },
    }),
  ]);

  const total = diff.lines.filter((l) => l.expected !== null).length;
  const scanned = diff.lines.filter((l) => l.actual !== null).length;

  const components: CapturedComponent[] = diff.lines
    .filter((l) => l.actual !== null)
    .map((l) => ({
      position: l.position,
      partNumber: l.actual!.partNumber,
      rev: l.actual!.rev,
      lotCode: l.actual!.lotCode,
      isSubstitution: l.isSubstitution,
      captured: true,
    }))
    // substitutions lead — they are the reason this screen exists
    .sort(
      (a, b) =>
        Number(b.isSubstitution) - Number(a.isSubstitution) ||
        a.position.localeCompare(b.position),
    );

  const capturedPositions = new Set(
    diff.lines.filter((l) => l.actual !== null).map((l) => l.position),
  );
  const openPositions: OpenPosition[] = bom
    .filter((b) => !capturedPositions.has(b.position))
    .map((b) => ({
      position: b.position,
      partNumber: b.partRevision.partMaster.partNumber,
      rev: b.partRevision.rev,
      partRevisionId: b.partRevisionId,
    }))
    .sort((a, b) => a.position.localeCompare(b.position));

  return {
    serial: unit.serial,
    bomRevision: model?.designRevision ?? "—",
    scanned,
    total,
    substitutions: diff.summary.substitutions,
    lastCapturedAt: lastRecord?.installedAt ?? null,
    components,
    openPositions,
    asBuiltHref: `/units/${encodeURIComponent(unit.serial)}/as-built`,
  };
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
