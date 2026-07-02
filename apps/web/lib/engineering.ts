import { dbForOrg, paginateArgs, pageResult } from "@axona/db";

// ENG.1 — Engineering & PLM read/API layer (build-spec §4.18, §6). Read-only over
// the existing models (ECO / FirmwareRelease / CompatCell): no schema change, no
// mutations (the ECO board + HW↔firmware compat-matrix screen is ENG.2).
// Everything org-scoped via dbForOrg; lists paginated with the FND.11 helpers.

// Change-control stages, in board order (the release approval state machine is
// RBAC.4; here stage is a plain status).
export const ECO_STAGES = ["DRAFT", "REVIEW", "APPROVED", "RELEASED"] as const;

export interface Eco {
  id: string;
  code: string;
  title: string;
  changeType: string;
  affected: string;
  stage: string;
}
export interface FirmwareRelease {
  id: string;
  version: string;
  note: string;
  state: string;
}
export interface CompatCell {
  id: string;
  hwRev: string;
  fwVersion: string;
  state: string; // cert / compatible / in-test / na
}
export interface CompatMatrix {
  hwRevs: string[]; // matrix rows (axis)
  fwVersions: string[]; // matrix columns (axis, newest first)
  cells: CompatCell[];
}
export interface EngineeringData {
  ecos: Eco[];
  firmwareReleases: FirmwareRelease[];
  compatMatrix: CompatMatrix;
}

/**
 * Everything the Engineering screen (ENG.2) needs, org-scoped and read-only:
 * - ecos: the change-order table (newest first); each carries its stage.
 * - firmwareReleases: releases newest-first (v4.2.2-rc / v4.2.1 / v4.1.0).
 * - compatMatrix: HW↔firmware cells + the axes — hwRevs newest-first (rows),
 *   fwVersions oldest-first (columns), matching Engineering.dc.html.
 */
export async function getEngineeringData(
  orgId: string,
): Promise<EngineeringData> {
  const db = dbForOrg(orgId);

  const [ecos, firmwareReleases, cells] = await Promise.all([
    db.eCO.findMany({
      orderBy: { code: "desc" },
      take: 200,
      select: {
        id: true,
        code: true,
        title: true,
        changeType: true,
        affected: true,
        stage: true,
      },
    }),
    db.firmwareRelease.findMany({
      orderBy: { version: "desc" },
      take: 100,
      select: { id: true, version: true, note: true, state: true },
    }),
    db.compatCell.findMany({
      orderBy: [{ hwRev: "desc" }, { fwVersion: "asc" }],
      take: 400,
      select: { id: true, hwRev: true, fwVersion: true, state: true },
    }),
  ]);

  const hwRevs = [...new Set(cells.map((c) => c.hwRev))].sort().reverse(); // rows: newest platform first
  const fwVersions = [...new Set(cells.map((c) => c.fwVersion))].sort(); // cols: oldest → newest

  return {
    ecos,
    firmwareReleases,
    compatMatrix: { hwRevs, fwVersions, cells },
  };
}

/** Paginated ECO list (read-only), optionally filtered by stage. */
export async function listEcos(
  orgId: string,
  opts: { stage?: string; cursor?: string; take?: number } = {},
) {
  const take = opts.take ?? 50;
  const rows = await dbForOrg(orgId).eCO.findMany({
    where: opts.stage ? { stage: opts.stage } : {},
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: {
      id: true,
      code: true,
      title: true,
      changeType: true,
      affected: true,
      stage: true,
    },
  });
  return pageResult(rows, take);
}

/** Paginated firmware-release list (read-only). */
export async function listFirmware(
  orgId: string,
  opts: { cursor?: string; take?: number } = {},
) {
  const take = opts.take ?? 50;
  const rows = await dbForOrg(orgId).firmwareRelease.findMany({
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: { id: true, version: true, note: true, state: true },
  });
  return pageResult(rows, take);
}

/** Paginated compat-cell list (read-only). */
export async function listCompat(
  orgId: string,
  opts: { cursor?: string; take?: number } = {},
) {
  const take = opts.take ?? 100;
  const rows = await dbForOrg(orgId).compatCell.findMany({
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: { id: true, hwRev: true, fwVersion: true, state: true },
  });
  return pageResult(rows, take);
}
