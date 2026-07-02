import { dbForOrg, paginateArgs, pageResult } from "@axona/db";

// LEGAL.1 — Legal & Compliance read/API layer (build-spec §4.23, §6). Read-only
// over the existing Obligation / ExportLicense / LegalMatter models: no schema
// change, no mutations (the obligations/export/matters screen is LEGAL.2). Org-
// scoped via dbForOrg; lists paginated with the FND.11 helpers. Closes the BMW
// thread: 99.5% SLA at-risk (autonomy regression) · DLV-3312 EAR99 export hold ·
// ECO-318 patent + INC-201 liability matters, linked back to their source modules.

const CAP = 200;
const CLOSED = new Set(["CLOSED", "RESOLVED", "DONE", "CLEARED"]);

export interface LegalObligation {
  id: string;
  account: string;
  obligation: string;
  actual: string;
  state: string;
  atRisk: boolean;
}
export interface LegalExportLicense {
  id: string;
  destination: string;
  code: string;
  state: string;
  onHold: boolean;
}
export interface LegalMatterRow {
  id: string;
  type: string;
  title: string;
  linkedTo: string;
  status: string;
  module: string | null; // source module inferred from linkedTo (ECO→engineering …)
  open: boolean;
}
export interface LegalRollup {
  obligationsAtRisk: number;
  exportHolds: number;
  openMatters: number;
}
export interface LegalData {
  obligations: LegalObligation[];
  exportLicenses: LegalExportLicense[];
  legalMatters: LegalMatterRow[];
  rollup: LegalRollup;
}

const isAtRisk = (state: string) => state.toUpperCase().includes("RISK");
const isOnHold = (state: string) => state.toUpperCase() === "HOLD";
const isOpen = (status: string) => !CLOSED.has(status.toUpperCase());

// Link a matter back to the module that produced its source artifact.
const MODULE_BY_PREFIX: Record<string, string> = {
  ECO: "engineering",
  INC: "autonomy",
  NCR: "quality",
  DLV: "fulfillment",
  PO: "procurement",
  WO: "field-service",
  CVE: "security",
  INV: "finance",
};
function moduleOf(linkedTo: string): string | null {
  const prefix = linkedTo.split("-")[0]?.toUpperCase() ?? "";
  return MODULE_BY_PREFIX[prefix] ?? null;
}

const MATTER_SELECT = {
  id: true,
  type: true,
  title: true,
  linkedTo: true,
  status: true,
} as const;

/**
 * Everything the Legal & Compliance screen (LEGAL.2) needs, org-scoped and
 * read-only: obligations vs live ops (BMW 99.5% fleet SLA at-risk from the
 * autonomy regression), export licenses (DLV-3312 EAR99 hold), and legal matters
 * (ECO-318 patent + INC-201 liability, linked to their source modules), + rollup.
 */
export async function getLegalData(orgId: string): Promise<LegalData> {
  const db = dbForOrg(orgId);

  const [obRows, exRows, mtRows] = await Promise.all([
    db.obligation.findMany({
      take: CAP,
      select: {
        id: true,
        account: true,
        obligation: true,
        actual: true,
        state: true,
      },
    }),
    db.exportLicense.findMany({
      take: CAP,
      select: { id: true, destination: true, code: true, state: true },
    }),
    db.legalMatter.findMany({ take: CAP, select: MATTER_SELECT }),
  ]);

  const obligations: LegalObligation[] = obRows.map((o) => ({
    ...o,
    atRisk: isAtRisk(o.state),
  }));
  const exportLicenses: LegalExportLicense[] = exRows.map((e) => ({
    ...e,
    onHold: isOnHold(e.state),
  }));
  const legalMatters: LegalMatterRow[] = mtRows.map((m) => ({
    ...m,
    module: moduleOf(m.linkedTo),
    open: isOpen(m.status),
  }));

  return {
    obligations,
    exportLicenses,
    legalMatters,
    rollup: {
      obligationsAtRisk: obligations.filter((o) => o.atRisk).length,
      exportHolds: exportLicenses.filter((e) => e.onHold).length,
      openMatters: legalMatters.filter((m) => m.open).length,
    },
  };
}

/** Paginated obligations list (read-only), optionally filtered by state. */
export async function listObligations(
  orgId: string,
  opts: { state?: string; cursor?: string; take?: number } = {},
) {
  const take = opts.take ?? 50;
  const rows = await dbForOrg(orgId).obligation.findMany({
    where: opts.state ? { state: opts.state } : {},
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: {
      id: true,
      account: true,
      obligation: true,
      actual: true,
      state: true,
    },
  });
  const { items, nextCursor } = pageResult(rows, take);
  return {
    items: items.map((o) => ({ ...o, atRisk: isAtRisk(o.state) })),
    nextCursor,
  };
}

/** Paginated export-license list (read-only). */
export async function listExportLicenses(
  orgId: string,
  opts: { cursor?: string; take?: number } = {},
) {
  const take = opts.take ?? 50;
  const rows = await dbForOrg(orgId).exportLicense.findMany({
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: { id: true, destination: true, code: true, state: true },
  });
  const { items, nextCursor } = pageResult(rows, take);
  return {
    items: items.map((e) => ({ ...e, onHold: isOnHold(e.state) })),
    nextCursor,
  };
}

/** Paginated legal-matter list (read-only), optionally filtered by status. */
export async function listMatters(
  orgId: string,
  opts: { status?: string; cursor?: string; take?: number } = {},
) {
  const take = opts.take ?? 50;
  const rows = await dbForOrg(orgId).legalMatter.findMany({
    where: opts.status ? { status: opts.status } : {},
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: MATTER_SELECT,
  });
  const { items, nextCursor } = pageResult(rows, take);
  return {
    items: items.map((m) => ({
      ...m,
      module: moduleOf(m.linkedTo),
      open: isOpen(m.status),
    })),
    nextCursor,
  };
}
