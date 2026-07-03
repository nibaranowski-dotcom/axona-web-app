import { dbForOrg, paginateArgs, pageResult } from "@axona/db";
import { parseCerts, type TechCert } from "./certs";

// PPL.1 — People read/API layer (build-spec §4.21, §6). Read-only over the
// existing Technician / Requisition models: no schema change, no mutations (the
// cert-matrix screen is PPL.2). Org-scoped via dbForOrg; lists paginated with the
// FND.11 helpers. Closes the Osei thread: the cert matrix that GATES field
// dispatch — M. Osei's HV/battery cert is EXPIRING (ties back to Field Service).
// Cert parsing is shared with FIELD.1 via lib/certs.

const TECH_CAP = 500;
const REQ_CAP = 200;

export interface PeopleTech {
  id: string;
  name: string;
  initials: string;
  site: string;
  status: string;
  certs: TechCert[];
  certExpiring: boolean; // any cert expiring — the dispatch gate
}
export interface CertMatrix {
  certKeys: string[]; // union of cert keys → the grid columns
  technicians: PeopleTech[]; // the tech × cert rows
}
export interface PeopleRequisition {
  id: string;
  role: string;
  filled: number;
  target: number;
  open: number; // target − filled (never negative)
}
export interface PeopleRollup {
  certsExpiring: number; // expiring cert instances across the team
  headcountFilled: number;
  headcountTarget: number;
  fieldTeamSize: number;
}
export interface PeopleData {
  certMatrix: CertMatrix;
  fieldTeam: PeopleTech[]; // the roster (same techs; the screen groups by site/status)
  requisitions: PeopleRequisition[];
  rollup: PeopleRollup;
}

const TECH_SELECT = {
  id: true,
  name: true,
  initials: true,
  site: true,
  status: true,
  certs: true,
} as const;

function shapeTech(t: {
  id: string;
  name: string;
  initials: string;
  site: string;
  status: string;
  certs: unknown;
}): PeopleTech {
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
}

/**
 * Everything the People / cert-matrix screen (PPL.2) needs, org-scoped and read-
 * only: the cert matrix (technicians × certs, with M. Osei's HV/battery cert
 * EXPIRING — the dispatch gate), the field-team roster, headcount requisitions,
 * and a rollup.
 */
export async function getPeopleData(orgId: string): Promise<PeopleData> {
  const db = dbForOrg(orgId);

  const [techRows, reqRows] = await Promise.all([
    db.technician.findMany({
      orderBy: { name: "asc" },
      take: TECH_CAP,
      select: TECH_SELECT,
    }),
    db.requisition.findMany({
      orderBy: { role: "asc" },
      take: REQ_CAP,
      select: { id: true, role: true, filled: true, target: true },
    }),
  ]);

  const technicians = techRows.map(shapeTech);
  const certKeys = [
    ...new Set(technicians.flatMap((t) => t.certs.map((c) => c.key))),
  ].sort();

  const requisitions: PeopleRequisition[] = reqRows.map((r) => ({
    ...r,
    open: Math.max(0, r.target - r.filled),
  }));

  return {
    certMatrix: { certKeys, technicians },
    fieldTeam: technicians,
    requisitions,
    rollup: {
      certsExpiring: technicians.reduce(
        (n, t) => n + t.certs.filter((c) => c.expiring).length,
        0,
      ),
      headcountFilled: requisitions.reduce((n, r) => n + r.filled, 0),
      headcountTarget: requisitions.reduce((n, r) => n + r.target, 0),
      fieldTeamSize: technicians.length,
    },
  };
}

/** Paginated technician list (read-only, with the parsed cert matrix). */
export async function listTechnicians(
  orgId: string,
  opts: { cursor?: string; take?: number } = {},
) {
  const take = opts.take ?? 50;
  const rows = await dbForOrg(orgId).technician.findMany({
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: TECH_SELECT,
  });
  const { items, nextCursor } = pageResult(rows, take);
  return { items: items.map(shapeTech), nextCursor };
}

/** Paginated requisition list (read-only). */
export async function listRequisitions(
  orgId: string,
  opts: { cursor?: string; take?: number } = {},
) {
  const take = opts.take ?? 50;
  const rows = await dbForOrg(orgId).requisition.findMany({
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: { id: true, role: true, filled: true, target: true },
  });
  const { items, nextCursor } = pageResult(rows, take);
  return {
    items: items.map((r) => ({ ...r, open: Math.max(0, r.target - r.filled) })),
    nextCursor,
  };
}
