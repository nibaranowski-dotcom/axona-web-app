import { leafOnly } from "./bom";
import type { OrgScopedDb } from "../client";

// BR.1 — Build-readiness rollup. A PURE read over data we already capture: the
// unit's as-designed BOM × on-hand inventory × open-PO coverage. There is NO new
// "readiness" table — the rollup reconciles exactly with the same PO/stock reads
// the Procurement screen shows (no second source of truth). Reusable for EVERY
// tenant — nothing here special-cases a customer.
//
// Deterministic: `now` is injected (VERIFY.2) so the late/on-order split is stable
// in tests — no bare Date.now() inside the classification.
//
// The design↔procurement bridge is the string code itself: a BOM line's design
// `PartMaster.partNumber` matches a procurement `Part.sku` (a convention, no FK).
// A line with no matching procurement Part is UNTRACKED — we cannot confirm supply,
// so it classifies as `missing` (and carries `tracked=false` so the UI can say so).

export type BomReadinessState = "in_house" | "on_order" | "late" | "missing";

/** A PO counts as open coverage until it is received (RECEIVED) or rejected. */
const OPEN_PO_STATUSES = [
  "DRAFTED",
  "AWAITING_APPROVAL",
  "APPROVED",
  "SENT",
] as const;

/** One covering purchase order (the fields the classification needs). */
export interface CoveringPo {
  code: string;
  eta: Date | null;
}

/** The pure input for one BOM line — everything already fetched, org-scoped. */
export interface ReadinessLineInput {
  position: string;
  partNumber: string;
  name: string;
  required: number;
  /** on-hand for the matched procurement Part; 0 when untracked. */
  onHand: number;
  /** false when no procurement Part matches this design partNumber. */
  tracked: boolean;
  /** open POs covering this part. */
  openPos: CoveringPo[];
}

export interface ReadinessLine {
  position: string;
  partNumber: string;
  name: string;
  required: number;
  onHand: number;
  /** units still short (max(0, required − onHand)). */
  shortBy: number;
  state: BomReadinessState;
  tracked: boolean;
  /** the covering PO surfaced for on-order/late lines (null otherwise). */
  coveringPo: string | null;
  coveringPoEta: Date | null;
}

export interface BlockingPart {
  position: string;
  partNumber: string;
  name: string;
  state: "late" | "missing";
  shortBy: number;
  tracked: boolean;
  coveringPo: string | null;
}

export interface BuildReadiness {
  unitId: string;
  lineCount: number;
  counts: Record<BomReadinessState, number>;
  pctInHouse: number;
  pctOnOrder: number;
  pctLate: number;
  pctMissing: number;
  lines: ReadinessLine[];
  /** blocking = late ∪ missing (what stands between this unit and "ready"). */
  blockingParts: BlockingPart[];
}

function classifyLine(line: ReadinessLineInput, now: number): ReadinessLine {
  const shortBy = Math.max(0, line.required - line.onHand);
  const base = {
    position: line.position,
    partNumber: line.partNumber,
    name: line.name,
    required: line.required,
    onHand: line.onHand,
    shortBy,
    tracked: line.tracked,
  };
  // enough on hand → built/buildable from stock.
  if (shortBy === 0)
    return {
      ...base,
      state: "in_house",
      coveringPo: null,
      coveringPoEta: null,
    };
  // a gap with no covering PO → missing (includes untracked lines: onHand 0, no PO).
  if (line.openPos.length === 0)
    return { ...base, state: "missing", coveringPo: null, coveringPoEta: null };
  // a covering PO past its promised date → late.
  const latePo = line.openPos.find(
    (p) => p.eta !== null && p.eta.getTime() < now,
  );
  if (latePo)
    return {
      ...base,
      state: "late",
      coveringPo: latePo.code,
      coveringPoEta: latePo.eta,
    };
  // else on order — surface the earliest-promised covering PO (openPos is non-empty
  // here: the empty case returned `missing` above).
  const soonest = [...line.openPos].sort(
    (a, b) => (a.eta?.getTime() ?? Infinity) - (b.eta?.getTime() ?? Infinity),
  )[0]!;
  return {
    ...base,
    state: "on_order",
    coveringPo: soonest.code,
    coveringPoEta: soonest.eta,
  };
}

/**
 * The PURE rollup — classify each BOM line, count states, derive percentages, and
 * collect the blocking parts (late ∪ missing). Kept separate from the DB fetch so
 * it is exhaustively testable against hand-computed fixtures with an injected `now`.
 */
export function rollupBuildReadiness(
  unitId: string,
  lines: ReadinessLineInput[],
  now: number,
): BuildReadiness {
  const resolved = lines.map((l) => classifyLine(l, now));
  const counts: Record<BomReadinessState, number> = {
    in_house: 0,
    on_order: 0,
    late: 0,
    missing: 0,
  };
  for (const l of resolved) counts[l.state]++;
  const n = resolved.length;
  const pct = (c: number) => (n === 0 ? 0 : Math.round((c / n) * 100));
  const blockingParts: BlockingPart[] = resolved
    .filter((l) => l.state === "late" || l.state === "missing")
    .map((l) => ({
      position: l.position,
      partNumber: l.partNumber,
      name: l.name,
      state: l.state as "late" | "missing",
      shortBy: l.shortBy,
      tracked: l.tracked,
      coveringPo: l.coveringPo,
    }));
  return {
    unitId,
    lineCount: n,
    counts,
    pctInHouse: pct(counts.in_house),
    pctOnOrder: pct(counts.on_order),
    pctLate: pct(counts.late),
    pctMissing: pct(counts.missing),
    lines: resolved,
    blockingParts,
  };
}

/**
 * Compute a unit's build-readiness from captured data. Org-isolation is inherited
 * from the org-scoped `db` (dbForOrg) — every query below is auto-scoped, so a unit
 * from another tenant is simply "not found" (never a leak). Deterministic via `now`.
 */
export async function computeBuildReadiness(
  db: OrgScopedDb,
  unitId: string,
  opts: { now?: number } = {},
): Promise<BuildReadiness> {
  const now = opts.now ?? Date.now();

  // findFirst (not findUnique) so the org-scoped client injects orgId — the house
  // rule for tenant isolation (client.ts): a unit from another tenant is not found.
  const unit = await db.unit.findFirst({
    where: { id: unitId },
    select: {
      id: true,
      productModelId: true,
      productModel: { select: { designRevision: true } },
    },
  });
  if (!unit) throw new Error(`Unit ${unitId} not found in this org`);

  // as-designed BOM for this unit's model (one row per PHYSICAL position).
  // PLM.13: leaves only — an assembly node is not a purchasable part, so
  // sourcing one would invent a line no supplier can cover.
  const bom = leafOnly(
    await db.bomLine.findMany({
      where: {
        productModelId: unit.productModelId,
        designRevision: unit.productModel.designRevision,
      },
      include: { partRevision: { include: { partMaster: true } } },
      orderBy: { position: "asc" },
    }),
  );

  // bridge design → procurement by the shared code (partNumber === sku).
  const partNumbers = [
    ...new Set(bom.map((b) => b.partRevision.partMaster.partNumber)),
  ];
  const parts = partNumbers.length
    ? await db.part.findMany({
        where: { sku: { in: partNumbers } },
        select: { id: true, sku: true, onHand: true },
      })
    : [];
  const partBySku = new Map(parts.map((p) => [p.sku, p]));

  // open (covering) POs for those parts, grouped by partId.
  const partIds = parts.map((p) => p.id);
  const pos = partIds.length
    ? await db.purchaseOrder.findMany({
        where: {
          partId: { in: partIds },
          status: { in: [...OPEN_PO_STATUSES] },
        },
        select: { code: true, eta: true, partId: true },
      })
    : [];
  const posByPartId = new Map<string, CoveringPo[]>();
  for (const po of pos) {
    const arr = posByPartId.get(po.partId) ?? [];
    arr.push({ code: po.code, eta: po.eta });
    posByPartId.set(po.partId, arr);
  }

  const lines: ReadinessLineInput[] = bom.map((b) => {
    const partNumber = b.partRevision.partMaster.partNumber;
    const part = partBySku.get(partNumber);
    return {
      position: b.position,
      partNumber,
      name: b.partRevision.partMaster.description,
      required: b.qty,
      onHand: part?.onHand ?? 0,
      tracked: !!part,
      openPos: part ? (posByPartId.get(part.id) ?? []) : [],
    };
  });

  return rollupBuildReadiness(unitId, lines, now);
}
