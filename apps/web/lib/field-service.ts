import { dbForOrg, paginateArgs, pageResult } from "@axona/db";
import type { Severity } from "@axona/db";

// FIELD.1 — Field Service read/API layer (build-spec §4.17, §6). Read-only over
// the existing WorkOrderField / Technician models: no schema change, no mutations
// (the dispatch board is FIELD.2). Org-scoped via dbForOrg; lists paginated with
// the FND.11 helpers. Closes the robotics thread: SN-2196 thermal (Fleet) →
// WO-5521 battery-swap dispatch, gated by M. Osei's HV/battery cert.

const DUE_SOON_MS = 12 * 3600 * 1000; // "due soon" SLA window
const CERT_WINDOW_MS = 30 * 24 * 3600 * 1000; // cert-expiring window
const CLOSED = new Set(["CLOSED", "DONE", "COMPLETE", "COMPLETED"]);

export interface TechCert {
  key: string;
  state: string;
  expiresAt: Date | null;
  expiring: boolean; // state EXPIRING or within the cert window
}
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
export interface FieldServiceData {
  workOrders: FieldWorkOrder[];
  technicians: FieldTech[];
  board: DispatchColumn[]; // per-tech dispatch board
  sla: SlaRollup;
}

function parseCerts(certs: unknown): TechCert[] {
  if (!certs || typeof certs !== "object") return [];
  const now = Date.now();
  return Object.entries(
    certs as Record<string, { state?: string; expiresAt?: string }>,
  ).map(([key, v]) => {
    const expiresAt = v?.expiresAt ? new Date(v.expiresAt) : null;
    const expiring =
      (v?.state ?? "").toUpperCase() === "EXPIRING" ||
      (!!expiresAt && expiresAt.getTime() - now <= CERT_WINDOW_MS);
    return { key, state: v?.state ?? "UNKNOWN", expiresAt, expiring };
  });
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

  return { workOrders, technicians, board, sla };
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
