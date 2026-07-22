import { dbForOrg, resolveConfigAt, type UnitStatus } from "@axona/db";

// PLM.2 — the Unit registry read model. Answers the query that sells the product:
// "which units run sw v4.2.1, at Site-2, from lot 88421?" Every column is RESOLVED
// from captured records (as-built + the software time series), never a stored
// scalar that can drift from what the unit actually is.
//
// Resolution is BATCHED (a handful of queries for the whole page, not one
// resolveConfigAt per row) because the registry is a list screen. The matching
// rule is the same one resolveConfigAt applies — verify:plm-2 asserts the two
// agree on a real unit, so this batch path can never silently drift from the
// single-unit path the Unit page (PLM.3) uses.

export interface UnitRow {
  serial: string;
  modelCode: string;
  modelName: string;
  /** Resolved ConfigurationVersion name, or null when no named config matches. */
  configVersion: string | null;
  configIsBaseline: boolean;
  swVersion: string | null;
  site: string | null;
  customer: string | null;
  status: UnitStatus;
  openIssues: number;
  /** Distinct lot codes this unit was built with (as-built capture). */
  lots: string[];
  substitutions: number;
  lastEventAt: Date | null;
}

export interface UnitFilters {
  q?: string;
  model?: string;
  config?: string;
  sw?: string;
  lot?: string;
  site?: string;
  status?: string;
}

export interface UnitFacets {
  model: string[];
  config: string[];
  sw: string[];
  lot: string[];
  site: string[];
  status: string[];
}

export interface UnitRegistryData {
  rows: UnitRow[];
  /** Units matching the active filters (the whole set, not this page). */
  matched: number;
  /** Units in the registry, unfiltered — "of N in registry". */
  total: number;
  page: number;
  pageSize: number;
  facets: UnitFacets;
}

export const UNIT_PAGE_SIZE = 25;

/** Which filters exist, in the order the screen offers them. */
export const FILTER_KEYS = [
  "model",
  "config",
  "sw",
  "lot",
  "site",
  "status",
] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

/** Human labels for the status enum (sentence case, per the v2 voice). */
export const STATUS_LABEL: Record<string, string> = {
  in_build: "Building",
  in_test: "In test",
  deployed: "Deployed",
  active: "Active",
  decommissioned: "Decommissioned",
};

/**
 * Build the registry rows + facet options for an org, applying the (combinable)
 * filters. Org-scoped via dbForOrg — a second tenant sees none of this.
 */
export async function getUnitRegistry(
  orgId: string,
  filters: UnitFilters = {},
  page = 1,
  pageSize = UNIT_PAGE_SIZE,
): Promise<UnitRegistryData> {
  const db = dbForOrg(orgId);

  const units = await db.unit.findMany({
    include: { productModel: true },
    orderBy: { serial: "asc" },
  });
  const total = units.length;
  if (total === 0) {
    return {
      rows: [],
      matched: 0,
      total: 0,
      page: 1,
      pageSize,
      facets: { model: [], config: [], sw: [], lot: [], site: [], status: [] },
    };
  }

  const unitIds = units.map((u) => u.id);

  // ── batch the three captured sources the resolved columns come from ────────
  const [asBuilt, swStates, configs, unitLinks] = await Promise.all([
    db.asBuiltRecord.findMany({
      where: { unitId: { in: unitIds } },
      select: {
        unitId: true,
        lotCode: true,
        isSubstitution: true,
        installedAt: true,
      },
    }),
    db.unitSoftwareState.findMany({
      where: { unitId: { in: unitIds } },
      include: { softwareRelease: true },
      orderBy: { effectiveFrom: "desc" },
    }),
    db.configurationVersion.findMany(),
    // Open issues reach a unit through the ONT.1 graph (NCR —AFFECTS→ UNIT).
    // Since PLM.2 a UNIT node IS the Unit, so this joins directly on unit id.
    db.entityLink.findMany({
      where: {
        OR: [
          { toType: "UNIT", toId: { in: unitIds }, fromType: "NCR" },
          { fromType: "UNIT", fromId: { in: unitIds }, toType: "NCR" },
        ],
      },
    }),
  ]);

  // NCR status decides whether a linked issue is still open.
  const ncrIds = [
    ...new Set(
      unitLinks.map((l) => (l.fromType === "NCR" ? l.fromId : l.toId)),
    ),
  ];
  const ncrs = ncrIds.length
    ? await db.nCR.findMany({ where: { id: { in: ncrIds } } })
    : [];
  const openNcrIds = new Set(
    ncrs
      .filter((n) => !CLOSED_NCR.has(n.status.toUpperCase()))
      .map((n) => n.id),
  );

  // ── fold the captured records into per-unit shape ─────────────────────────
  const now = new Date();
  const byUnit = new Map<
    string,
    {
      lots: Set<string>;
      substitutions: number;
      lastEvent: Date | null;
      sw: string | null;
      openIssues: number;
    }
  >();
  for (const id of unitIds)
    byUnit.set(id, {
      lots: new Set(),
      substitutions: 0,
      lastEvent: null,
      sw: null,
      openIssues: 0,
    });

  for (const r of asBuilt) {
    const acc = byUnit.get(r.unitId)!;
    if (r.lotCode) acc.lots.add(r.lotCode);
    if (r.isSubstitution) acc.substitutions++;
    if (!acc.lastEvent || r.installedAt > acc.lastEvent)
      acc.lastEvent = r.installedAt;
  }
  // The software state covering NOW is this unit's current firmware — the same
  // [effectiveFrom, effectiveTo) window rule resolveConfigAt applies.
  for (const s of swStates) {
    const acc = byUnit.get(s.unitId)!;
    const coversNow =
      s.effectiveFrom <= now && (s.effectiveTo === null || s.effectiveTo > now);
    if (coversNow && acc.sw === null) acc.sw = s.softwareRelease.version;
    if (!acc.lastEvent || s.effectiveFrom > acc.lastEvent)
      acc.lastEvent = s.effectiveFrom;
  }
  for (const l of unitLinks) {
    const unitId = l.fromType === "UNIT" ? l.fromId : l.toId;
    const ncrId = l.fromType === "NCR" ? l.fromId : l.toId;
    const acc = byUnit.get(unitId);
    if (acc && openNcrIds.has(ncrId)) acc.openIssues++;
  }

  // Named configuration = the version whose swSpec matches the resolved firmware
  // for this unit's product model (resolveConfigAt's rule, batched).
  const configFor = (
    productModelId: string,
    sw: string | null,
  ): { name: string; isBaseline: boolean } | null => {
    if (!sw) return null;
    const match = configs.find(
      (c) =>
        c.productModelId === productModelId &&
        (c.swSpec as Record<string, unknown> | null)?.["firmware"] === sw,
    );
    return match ? { name: match.name, isBaseline: match.isBaseline } : null;
  };

  const allRows: UnitRow[] = units.map((u) => {
    const acc = byUnit.get(u.id)!;
    const cfg = configFor(u.productModelId, acc.sw);
    const lastEvent =
      acc.lastEvent && u.buildDate && u.buildDate > acc.lastEvent
        ? u.buildDate
        : (acc.lastEvent ?? u.buildDate);
    return {
      serial: u.serial,
      modelCode: u.productModel.code,
      modelName: u.productModel.name,
      configVersion: cfg?.name ?? null,
      configIsBaseline: cfg?.isBaseline ?? false,
      swVersion: acc.sw,
      site: u.siteLabel,
      customer: u.customerLabel,
      status: u.status,
      openIssues: acc.openIssues,
      lots: [...acc.lots].sort(),
      substitutions: acc.substitutions,
      lastEventAt: lastEvent,
    };
  });

  // ── facets from the FULL set (options never disappear as you filter) ───────
  const uniq = (xs: (string | null)[]) =>
    [...new Set(xs.filter((x): x is string => !!x))].sort();
  const facets: UnitFacets = {
    model: uniq(allRows.map((r) => r.modelCode)),
    config: uniq(allRows.map((r) => r.configVersion)),
    sw: uniq(allRows.map((r) => r.swVersion)),
    lot: uniq(allRows.flatMap((r) => r.lots)),
    site: uniq(allRows.map((r) => r.site)),
    status: uniq(allRows.map((r) => r.status)),
  };

  // ── combinable filters (AND across keys) ──────────────────────────────────
  const q = filters.q?.trim().toLowerCase();
  const matchedRows = allRows.filter((r) => {
    if (filters.model && r.modelCode !== filters.model) return false;
    if (filters.config && r.configVersion !== filters.config) return false;
    if (filters.sw && r.swVersion !== filters.sw) return false;
    if (filters.lot && !r.lots.includes(filters.lot)) return false;
    if (filters.site && r.site !== filters.site) return false;
    if (filters.status && r.status !== filters.status) return false;
    if (q) {
      const hay = [r.serial, r.customer, r.site, ...r.lots]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const safePage = Math.max(1, page);
  const start = (safePage - 1) * pageSize;
  return {
    rows: matchedRows.slice(start, start + pageSize),
    matched: matchedRows.length,
    total,
    page: safePage,
    pageSize,
    facets,
  };
}

/** NCR statuses that mean "no longer an open issue on this unit". */
const CLOSED_NCR = new Set(["CLOSED", "RESOLVED", "CANCELLED"]);

/**
 * The single-unit resolved config — the Unit page's (PLM.3) source and the
 * equivalence target verify:plm-2 checks the batch path against.
 */
export async function resolveUnitConfigNow(orgId: string, serial: string) {
  const db = dbForOrg(orgId);
  const unit = await db.unit.findFirst({ where: { serial } });
  if (!unit) return null;
  return resolveConfigAt(db, unit.id, new Date());
}
