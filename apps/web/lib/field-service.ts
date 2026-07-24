import { dbForOrg, paginateArgs, pageResult } from "@axona/db";
import type { Severity } from "@axona/db";
import { parseCerts, type TechCert } from "./certs";

// FIELD.1 — Field Service read/API layer (build-spec §4.17, §6). Read-only over
// the existing WorkOrderField / Technician models: no schema change, no mutations
// (the dispatch board is FIELD.2). Org-scoped via dbForOrg; lists paginated with
// the FND.11 helpers. Closes the robotics thread: SN-2196 thermal (Fleet) →
// WO-5521 battery-swap dispatch, gated by M. Osei's HV/battery cert.
// Cert parsing is shared with PPL.1 (people) via lib/certs.

const DUE_SOON_MS = 12 * 3600 * 1000; // "due soon" SLA window
const CLOSED = new Set(["CLOSED", "DONE", "COMPLETE", "COMPLETED"]);

export type { TechCert };
export interface FieldTech {
  id: string;
  name: string;
  initials: string;
  site: string;
  status: string;
  certs: TechCert[];
  certExpiring: boolean; // any cert expiring — gates dispatch (FIELD.2)
}
export interface FieldWorkOrder {
  id: string;
  code: string;
  robotSerial: string;
  site: string;
  issue: string;
  slaDueAt: Date | null;
  techId: string | null;
  status: string;
  severity: Severity;
  slaMsLeft: number | null; // ms to slaDueAt (negative = past due)
  slaBreached: boolean;
  dueSoon: boolean;
}
export interface DispatchColumn {
  tech: FieldTech;
  workOrders: FieldWorkOrder[]; // this tech's assigned work
}
export interface SlaRollup {
  open: number;
  dueSoon: number;
  breached: number;
}
// PLM.V5 — field modifications. A swap/mod at a deployed unit that updates its
// configuration, recorded so the golden thread stays intact (config drifts in the
// field and nobody records it — the most commonly missed PLM path).
export interface FieldModRow {
  id: string;
  serial: string;
  site: string;
  change: string; // the summary
  effect: string; // the config effect ("SERVO-204 → rev B")
  techWhen: string; // "M. Osei · 2h ago"
  state: string; // pending | approved | rejected
  unitHref: string; // links to the Unit page (PLM.3)
}

export interface RecordPosition {
  bomPosition: string;
  partNumber: string;
  currentRev: string;
  revisions: { id: string; rev: string }[]; // the part master's revisions
}
export interface RecordUnitOption {
  unitId: string;
  serial: string;
  site: string;
  positions: RecordPosition[]; // as-built positions (hw swap targets)
}
export interface RecordFormData {
  units: RecordUnitOption[];
  softwareReleases: { id: string; component: string; version: string }[];
}

export interface FieldServiceData {
  workOrders: FieldWorkOrder[];
  technicians: FieldTech[];
  board: DispatchColumn[]; // per-tech dispatch board
  sla: SlaRollup;
  fieldMods: FieldModRow[]; // PLM.V5
  recordForm: RecordFormData; // PLM.V5 — options for "+ Record field change"
}

function agoLabel(at: Date, now: number): string {
  const s = Math.max(0, Math.floor((now - at.getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function shapeWO(
  w: {
    id: string;
    code: string;
    robotSerial: string;
    site: string;
    issue: string;
    slaDueAt: Date | null;
    techId: string | null;
    status: string;
    severity: Severity;
  },
  now: number,
): FieldWorkOrder {
  const slaMsLeft = w.slaDueAt ? w.slaDueAt.getTime() - now : null;
  return {
    ...w,
    slaMsLeft,
    slaBreached: slaMsLeft != null && slaMsLeft < 0,
    dueSoon: slaMsLeft != null && slaMsLeft >= 0 && slaMsLeft <= DUE_SOON_MS,
  };
}

const WO_SELECT = {
  id: true,
  code: true,
  robotSerial: true,
  site: true,
  issue: true,
  slaDueAt: true,
  techId: true,
  status: true,
  severity: true,
} as const;

/**
 * Everything the dispatch board (FIELD.2) needs, org-scoped and read-only: work
 * orders with a live SLA countdown (WO-5521 SN-2196 battery swap, ticking),
 * technicians with their cert matrix (M. Osei's HV/battery cert expiring —
 * gates dispatch), the per-tech dispatch board, and an SLA rollup.
 */
export async function getFieldServiceData(
  orgId: string,
): Promise<FieldServiceData> {
  const db = dbForOrg(orgId);
  const now = Date.now();

  const [woRows, techRows] = await Promise.all([
    db.workOrderField.findMany({
      orderBy: { code: "desc" },
      take: 200,
      select: WO_SELECT,
    }),
    db.technician.findMany({
      orderBy: { name: "asc" },
      take: 100,
      select: {
        id: true,
        name: true,
        initials: true,
        site: true,
        status: true,
        certs: true,
      },
    }),
  ]);

  const workOrders = woRows.map((w) => shapeWO(w, now));
  const technicians: FieldTech[] = techRows.map((t) => {
    const certs = parseCerts(t.certs);
    return {
      id: t.id,
      name: t.name,
      initials: t.initials,
      site: t.site,
      status: t.status,
      certs,
      certExpiring: certs.some((c) => c.expiring),
    };
  });

  const board: DispatchColumn[] = technicians.map((t) => ({
    tech: t,
    workOrders: workOrders.filter((w) => w.techId === t.id),
  }));

  const openWOs = workOrders.filter((w) => !CLOSED.has(w.status.toUpperCase()));
  const sla: SlaRollup = {
    open: openWOs.length,
    dueSoon: openWOs.filter((w) => w.dueSoon).length,
    breached: openWOs.filter((w) => w.slaBreached).length,
  };

  const [fieldMods, recordForm] = await Promise.all([
    listFieldModifications(orgId, now),
    getRecordFormData(orgId),
  ]);

  return { workOrders, technicians, board, sla, fieldMods, recordForm };
}

/**
 * The recorded field modifications (PLM.V5), newest first — a swap/mod at a
 * deployed unit that updates its configuration. Each links to the Unit page; an
 * approved one has already moved the unit's resolved config forward.
 */
export async function listFieldModifications(
  orgId: string,
  now = Date.now(),
): Promise<FieldModRow[]> {
  const rows = await dbForOrg(orgId).fieldEvent.findMany({
    where: { kind: "field_modification" },
    orderBy: { occurredAt: "desc" },
    take: 50,
    select: {
      id: true,
      summary: true,
      effect: true,
      state: true,
      techLabel: true,
      occurredAt: true,
      unit: { select: { serial: true, siteLabel: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    serial: r.unit.serial,
    site: r.unit.siteLabel ?? "—",
    change: r.summary,
    effect: r.effect ?? "—",
    techWhen: `${r.techLabel ? `${r.techLabel} · ` : ""}${agoLabel(r.occurredAt, now)}`,
    state: r.state,
    unitHref: `/units/${r.unit.serial}`,
  }));
}

/**
 * Options for "+ Record field change": deployed/active units with their as-built
 * positions (hw swap targets, each carrying the part master's revisions) and the
 * org's software releases (sw-update targets). Bounded to the deployed fleet.
 */
export async function getRecordFormData(
  orgId: string,
): Promise<RecordFormData> {
  const db = dbForOrg(orgId);
  const [units, asBuilt, softwareReleases] = await Promise.all([
    db.unit.findMany({
      where: { status: { in: ["deployed", "active"] } },
      orderBy: { serial: "asc" },
      take: 40,
      select: { id: true, serial: true, siteLabel: true },
    }),
    db.asBuiltRecord.findMany({
      orderBy: { bomPosition: "asc" },
      take: 400,
      select: {
        unitId: true,
        bomPosition: true,
        partRevision: {
          select: {
            rev: true,
            partMaster: {
              select: {
                partNumber: true,
                revisions: {
                  select: { id: true, rev: true },
                  orderBy: { rev: "asc" },
                },
              },
            },
          },
        },
      },
    }),
    db.softwareRelease.findMany({
      orderBy: [{ component: "asc" }, { version: "asc" }],
      take: 60,
      select: { id: true, component: true, version: true },
    }),
  ]);

  const byUnit = new Map<string, RecordPosition[]>();
  for (const r of asBuilt) {
    const list = byUnit.get(r.unitId) ?? [];
    list.push({
      bomPosition: r.bomPosition,
      partNumber: r.partRevision.partMaster.partNumber,
      currentRev: r.partRevision.rev,
      revisions: r.partRevision.partMaster.revisions,
    });
    byUnit.set(r.unitId, list);
  }

  return {
    units: units.map((u) => ({
      unitId: u.id,
      serial: u.serial,
      site: u.siteLabel ?? "—",
      positions: byUnit.get(u.id) ?? [],
    })),
    softwareReleases,
  };
}

/** Paginated work-order list (read-only), optionally filtered by status. */
export async function listWorkOrders(
  orgId: string,
  opts: { status?: string; cursor?: string; take?: number } = {},
) {
  const take = opts.take ?? 50;
  const now = Date.now();
  const rows = await dbForOrg(orgId).workOrderField.findMany({
    where: opts.status ? { status: opts.status } : {},
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: WO_SELECT,
  });
  const { items, nextCursor } = pageResult(rows, take);
  return { items: items.map((w) => shapeWO(w, now)), nextCursor };
}

/** Paginated technician list (read-only). */
export async function listTechnicians(
  orgId: string,
  opts: { cursor?: string; take?: number } = {},
) {
  const take = opts.take ?? 50;
  const rows = await dbForOrg(orgId).technician.findMany({
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: {
      id: true,
      name: true,
      initials: true,
      site: true,
      status: true,
      certs: true,
    },
  });
  const { items, nextCursor } = pageResult(rows, take);
  return {
    items: items.map((t) => {
      const certs = parseCerts(t.certs);
      return { ...t, certs, certExpiring: certs.some((c) => c.expiring) };
    }),
    nextCursor,
  };
}
