import { dbForOrg, paginateArgs, pageResult } from "@axona/db";
import type { InventoryKind } from "@axona/db";
import { affectedUnits } from "@axona/agents";

// INV.1 — Inventory read/API layer (build-spec §4.11b, §6). Read-only over the
// EXISTING Part + PurchaseOrder models plus the bounded INV.1 InventoryStock
// (multi-echelon per-location on-hand/reserved/value). No mutations here.
// Reorder-needed parts tie to Procurement (PROC.1): we surface the incoming PO
// where one exists; the reorder itself is Procurement's agent-drafted job.
// Everything org-scoped via dbForOrg; lists paginated with the FND.11 helpers.
//
// MOAT / gating: replenishment · transfer · RMA are agent-DRAFTED/proposed only.
/// RBAC.4: the replenish/transfer approval state machine.
/// AUDIT.3: each proposal logs inputs·output·model·confidence·approver. No
/// event-log/confidence/approver columns here.
//
// DAYS OF COVER is a labelled STAND-IN: onHand ÷ Part.dailyUse (a seeded
// consumption constant). The real rate comes from the build-schedule / BOM
// explosion — deferred (docs/manual-checks deferred-ledger), never fabricated.

const STOCK_CAP = 1000;
const WATCH_DAYS = 10; // ≤ this many days of cover → "watch" (still above reorder)

export type PartStatus = "REORDER" | "WATCH" | "QUARANTINE" | "HEALTHY";

const KIND_LABEL: Record<InventoryKind, string> = {
  CENTRAL: "Central warehouse",
  LINE_SIDE: "Line-side",
  EDGE_CACHE: "Field edge caches",
  FINISHED_GOODS: "Finished goods",
  PLANT: "Plant",
};

export interface IncomingPO {
  code: string;
  qty: number;
  eta: Date | null;
  status: string;
}
export interface CriticalPart {
  id: string;
  sku: string;
  name: string;
  onHand: number;
  reserved: number;
  daysOfCover: number; // STAND-IN: onHand ÷ dailyUse
  reorderPoint: number;
  status: PartStatus;
  reorderNeeded: boolean; // onHand ≤ reorderPoint → handed to Procurement
  incomingPo: IncomingPO | null; // the tie to PROC.1 (never a write here)
}
export interface LocationStock {
  kind: InventoryKind;
  label: string;
  onHand: number;
  reserved: number;
  valueUsd: number;
  pct: number; // share of total valuation
}
export interface EdgeCache {
  location: string;
  onHand: number;
  reserved: number;
  minLevel: number;
  belowMin: boolean;
  skusShort: number;
  state: "STOCKED" | "REPLENISH";
}
export interface InventoryRollup {
  criticalCount: number;
  reorderNeeded: number;
  reservedTotal: number;
  sparesNearFleet: number; // edge-cache on-hand
  totalValueUsd: number;
}
// PLM.V6 — part master + lot traceability. Part master attributes (lifecycle,
// approved vendors, category) plus "which lot → which units", resolved through the
// SAME affectedUnits façade PLM.5's blast radius uses (never a second traversal).
export interface PartMasterRow {
  id: string;
  partNumber: string;
  name: string;
  category: string;
  vendors: string; // "Vendor A" (1) · "N approved" (many)
  lifecycle: string; // display label
  lifecycleTone: "eol" | "active" | "hold";
  lot: string | null; // a representative captured lot (the quarantined one wins)
  lotQuarantine: boolean;
  unitsInField: number; // units carrying this lot (via affectedUnits — PLM.5's façade)
  blastHref: string; // trace this lot on /blast-radius
}

export interface InventoryData {
  criticalParts: CriticalPart[];
  stockByLocation: LocationStock[];
  edgeCaches: EdgeCache[];
  rollup: InventoryRollup;
  partMaster: PartMasterRow[]; // PLM.V6
}

const QUARANTINE_LOT = "88421"; // the demo thread's suspect lot (NCR-118)

function lifecycleDisplay(status: string): {
  label: string;
  tone: PartMasterRow["lifecycleTone"];
} {
  switch (status) {
    case "active":
      return { label: "Active", tone: "active" };
    case "ncr_hold":
      return { label: "NCR hold", tone: "hold" };
    case "superseded":
      return { label: "Superseded", tone: "eol" };
    case "obsolete":
      return { label: "Obsolete", tone: "eol" };
    default:
      return { label: status, tone: "hold" };
  }
}

function vendorLabel(ids: string[]): string {
  if (ids.length === 0) return "—";
  if (ids.length === 1) return ids[0]!;
  return `${ids.length} approved`;
}

/**
 * Part master + lot traceability (PLM.V6): each part's lifecycle · approved
 * vendors · category, plus a representative captured lot and HOW MANY deployed
 * units carry it — resolved through `affectedUnits({ lot })`, the exact façade
 * PLM.5's blast radius uses (lot 88421 → the affected units, one source of truth).
 */
export async function listPartMasterTrace(
  orgId: string,
): Promise<PartMasterRow[]> {
  const db = dbForOrg(orgId);
  const [parts, asBuilt] = await Promise.all([
    db.partMaster.findMany({
      orderBy: { partNumber: "asc" },
      take: 200,
      select: {
        id: true,
        partNumber: true,
        description: true,
        category: true,
        lifecycleStatus: true,
        approvedVendorIds: true,
        revisions: { select: { id: true } },
      },
    }),
    db.asBuiltRecord.findMany({
      where: { lotCode: { not: null } },
      select: { lotCode: true, partRevisionId: true },
    }),
  ]);

  // lot codes captured against each part revision (as-built, never reconstructed)
  const lotsByRev = new Map<string, string[]>();
  for (const r of asBuilt) {
    if (!r.lotCode) continue;
    const list = lotsByRev.get(r.partRevisionId) ?? [];
    if (!list.includes(r.lotCode)) list.push(r.lotCode);
    lotsByRev.set(r.partRevisionId, list);
  }

  const rows: PartMasterRow[] = [];
  for (const p of parts) {
    const lots = p.revisions.flatMap((rev) => lotsByRev.get(rev.id) ?? []);
    const lot = lots.includes(QUARANTINE_LOT)
      ? QUARANTINE_LOT
      : (lots[0] ?? null);
    const lc = lifecycleDisplay(p.lifecycleStatus);
    // lot → units through the SAME façade PLM.5 uses (as-built capture cohort).
    const unitsInField = lot
      ? (await affectedUnits(db, { lot })).units.length
      : 0;
    rows.push({
      id: p.id,
      partNumber: p.partNumber,
      name: p.description,
      category: p.category ?? "—",
      vendors: vendorLabel(p.approvedVendorIds),
      lifecycle: lc.label,
      lifecycleTone: lc.tone,
      lot,
      lotQuarantine: lot === QUARANTINE_LOT,
      unitsInField,
      blastHref: lot
        ? `/blast-radius?type=lot&value=${encodeURIComponent(lot)}`
        : "/blast-radius",
    });
  }

  // Traceable rows (a captured lot) lead; the quarantined lot first, then by reach.
  rows.sort((a, b) => {
    if (!!a.lot !== !!b.lot) return a.lot ? -1 : 1;
    if (a.lotQuarantine !== b.lotQuarantine) return a.lotQuarantine ? -1 : 1;
    return b.unitsInField - a.unitsInField;
  });
  return rows;
}

const coverStatus = (
  onHand: number,
  reorderPoint: number,
  days: number,
  quarantined: boolean,
): PartStatus => {
  if (quarantined) return "QUARANTINE";
  if (onHand <= reorderPoint) return "REORDER";
  if (days <= WATCH_DAYS) return "WATCH";
  return "HEALTHY";
};

// Labelled sku conventions (a real Part.class field is deferred — docs ledger):
//   LOT-*  = a quarantined lot (tied to Quality's NCR).
//   *-UNIT = a finished good (build OUTPUT) — tracked as stock, never a build part
//            with days-of-cover, so it's excluded from the critical-parts table.
const isQuarantined = (sku: string) => /^LOT-/i.test(sku);
const isFinishedUnit = (sku: string) => /-UNIT$/i.test(sku);

/**
 * The inventory picture (INV.1): critical parts with days-of-cover, multi-echelon
 * stock by location, edge caches near the fleet, and a rollup. Org-scoped, read-
 * only. Reorder-needed parts carry their incoming PROC.1 PO where one exists.
 */
export async function getInventoryData(orgId: string): Promise<InventoryData> {
  const db = dbForOrg(orgId);
  const partMasterP = listPartMasterTrace(orgId); // PLM.V6 (own dbForOrg scope)
  const [parts, stock] = await Promise.all([
    db.part.findMany({
      orderBy: { sku: "asc" },
      take: STOCK_CAP,
      select: {
        id: true,
        sku: true,
        name: true,
        onHand: true,
        reorderPoint: true,
        dailyUse: true,
        purchaseOrders: {
          where: { status: { notIn: ["RECEIVED"] } },
          orderBy: { eta: "asc" },
          take: 1,
          select: { code: true, qty: true, eta: true, status: true },
        },
      },
    }),
    db.inventoryStock.findMany({
      take: STOCK_CAP,
      select: {
        partId: true,
        kind: true,
        location: true,
        onHand: true,
        reserved: true,
        minLevel: true,
        valueUsd: true,
      },
    }),
  ]);

  // reserved per part (Σ across locations) — the multi-echelon reservation total.
  const reservedByPart = new Map<string, number>();
  for (const s of stock)
    reservedByPart.set(
      s.partId,
      (reservedByPart.get(s.partId) ?? 0) + s.reserved,
    );

  const criticalParts: CriticalPart[] = parts
    .filter((p) => !isFinishedUnit(p.sku)) // finished goods aren't build parts
    .map((p) => {
      const reserved = reservedByPart.get(p.id) ?? 0;
      const daysOfCover =
        p.dailyUse > 0 ? Math.floor(p.onHand / p.dailyUse) : p.onHand;
      const quarantined = isQuarantined(p.sku);
      const po = p.purchaseOrders[0] ?? null;
      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        onHand: p.onHand,
        reserved,
        daysOfCover,
        reorderPoint: p.reorderPoint,
        status: coverStatus(p.onHand, p.reorderPoint, daysOfCover, quarantined),
        reorderNeeded: !quarantined && p.onHand <= p.reorderPoint,
        incomingPo: po
          ? { code: po.code, qty: po.qty, eta: po.eta, status: po.status }
          : null,
      };
    });
  // Lead with what needs attention (reorder → watch → the rest).
  const order: Record<PartStatus, number> = {
    REORDER: 0,
    QUARANTINE: 1,
    WATCH: 2,
    HEALTHY: 3,
  };
  criticalParts.sort((a, b) => order[a.status] - order[b.status]);

  // stock by location kind
  const byKind = new Map<
    InventoryKind,
    { onHand: number; reserved: number; valueUsd: number }
  >();
  for (const s of stock) {
    const cur = byKind.get(s.kind) ?? { onHand: 0, reserved: 0, valueUsd: 0 };
    cur.onHand += s.onHand;
    cur.reserved += s.reserved;
    cur.valueUsd += s.valueUsd;
    byKind.set(s.kind, cur);
  }
  const totalValueUsd = [...byKind.values()].reduce(
    (n, v) => n + v.valueUsd,
    0,
  );
  const stockByLocation: LocationStock[] = [...byKind.entries()]
    .map(([kind, v]) => ({
      kind,
      label: KIND_LABEL[kind],
      onHand: v.onHand,
      reserved: v.reserved,
      valueUsd: v.valueUsd,
      pct: totalValueUsd ? Math.round((v.valueUsd / totalValueUsd) * 100) : 0,
    }))
    .sort((a, b) => b.valueUsd - a.valueUsd);

  // edge caches by location (spares near the fleet)
  const byLoc = new Map<
    string,
    { onHand: number; reserved: number; minLevel: number; short: number }
  >();
  for (const s of stock) {
    if (s.kind !== "EDGE_CACHE") continue;
    const cur = byLoc.get(s.location) ?? {
      onHand: 0,
      reserved: 0,
      minLevel: 0,
      short: 0,
    };
    cur.onHand += s.onHand;
    cur.reserved += s.reserved;
    cur.minLevel += s.minLevel;
    if (s.onHand < s.minLevel) cur.short += 1;
    byLoc.set(s.location, cur);
  }
  const edgeCaches: EdgeCache[] = [...byLoc.entries()]
    .map(([location, v]) => ({
      location,
      onHand: v.onHand,
      reserved: v.reserved,
      minLevel: v.minLevel,
      belowMin: v.short > 0,
      skusShort: v.short,
      state: v.short > 0 ? ("REPLENISH" as const) : ("STOCKED" as const),
    }))
    .sort((a, b) => a.location.localeCompare(b.location));

  return {
    criticalParts,
    stockByLocation,
    edgeCaches,
    partMaster: await partMasterP,
    rollup: {
      criticalCount: criticalParts.filter(
        (p) => p.status === "REORDER" || p.status === "WATCH",
      ).length,
      reorderNeeded: criticalParts.filter((p) => p.reorderNeeded).length,
      reservedTotal: [...reservedByPart.values()].reduce((n, r) => n + r, 0),
      sparesNearFleet: stock
        .filter((s) => s.kind === "EDGE_CACHE")
        .reduce((n, s) => n + s.onHand, 0),
      totalValueUsd,
    },
  };
}

/** Paginated stock list (read-only), optionally filtered by location. */
export async function listInventory(
  orgId: string,
  opts: { location?: string; cursor?: string; take?: number } = {},
) {
  const take = opts.take ?? 50;
  const rows = await dbForOrg(orgId).inventoryStock.findMany({
    where: { ...(opts.location ? { location: opts.location } : {}) },
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: {
      id: true,
      partId: true,
      location: true,
      kind: true,
      onHand: true,
      reserved: true,
      minLevel: true,
      valueUsd: true,
    },
  });
  return pageResult(rows, take);
}
