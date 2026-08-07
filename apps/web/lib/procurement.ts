import {
  dbForOrg,
  paginateArgs,
  pageResult,
  getCalibrationModel,
  calibratedConfidence,
} from "@axona/db";
import type { POStatus } from "@axona/db";

// PROC.1 — Procurement read/API layer (build-spec §4.10, §6). Read-only over the
// existing models (no schema change, no mutations — the queue screen + approve
// action are PROC.2). Everything org-scoped via dbForOrg; lists paginated with
// the FND.11 helpers.

export const PO_STATUSES: readonly POStatus[] = [
  "DRAFTED",
  "AWAITING_APPROVAL",
  "APPROVED",
  "SENT",
  "RECEIVED",
];

export function parsePoStatus(
  v: string | null | undefined,
): POStatus | undefined {
  return v && (PO_STATUSES as readonly string[]).includes(v)
    ? (v as POStatus)
    : undefined;
}

/** BR.1 — a part is "long-lead" at or above this many days (surfaced as a tag). */
export const LONG_LEAD_DAYS = 30;

export interface QueuePO {
  id: string;
  code: string;
  status: POStatus;
  qty: number;
  value: number;
  eta: Date | null; // promised delivery date
  receivedAt: Date | null; // BR.1 — actual goods-receipt date (null until received)
  supplier: string; // resolved from supplierId
  partSku: string; // resolved from partId
  draftedByAgentId: string | null;
  agentDrafted: boolean;
  /**
   * DEMO.6 #10 — for an agent-drafted PO: the confidence the agent STATED when it
   * drafted (read from its `po.draft` AUDIT.1 entry — the immutable record, never a
   * literal), corrected through the org's fitted CONF.1 map. Null when the PO was
   * raised by a human, or when the draft entry carried no confidence.
   */
  agentConfidence: {
    calibrated: number;
    raw: number;
    state: "calibrated" | "uncalibrated";
    model: string;
  } | null;
  // BR.1 supplier-risk flags (derived — no new columns):
  late: boolean; // past its promised date and not yet received
  longLead: boolean; // Part.leadDays ≥ LONG_LEAD_DAYS
  singleSource: boolean; // exactly one qualified vendor (PartMaster.approvedVendorIds)
}

export interface ReorderCandidate {
  id: string;
  sku: string;
  name: string;
  onHand: number;
  reorderPoint: number;
}

export interface ProcurementQueue {
  pos: QueuePO[];
  nextCursor: string | null;
  reorderCandidates: ReorderCandidate[];
}

/**
 * The PO queue: purchase orders (optionally filtered by status) with their
 * supplier name + part SKU joined and an agent-drafted flag, plus the reorder
 * recommendation (parts at/below reorder point — the ART.2 listReorderCandidates
 * logic). Read-only, org-scoped.
 */
export async function getProcurementQueue(
  orgId: string,
  opts: { status?: string; cursor?: string; take?: number } = {},
): Promise<ProcurementQueue> {
  const db = dbForOrg(orgId);
  const take = opts.take ?? 50;
  const status = parsePoStatus(opts.status);

  const [rows, reorderCandidates] = await Promise.all([
    db.purchaseOrder.findMany({
      where: status ? { status } : {},
      // cursor pagination keys on id (paginateArgs), so order by id for a stable page.
      orderBy: { id: "asc" },
      ...paginateArgs({ cursor: opts.cursor, take }),
      select: {
        id: true,
        code: true,
        status: true,
        qty: true,
        value: true,
        eta: true,
        receivedAt: true,
        draftedByAgentId: true,
        supplier: { select: { name: true } },
        part: { select: { sku: true, leadDays: true } },
      },
    }),
    // Reorder recommendation — column compare needs raw SQL; pin orgId ourselves.
    db.$queryRaw<
      ReorderCandidate[]
    >`SELECT id, sku, name, "onHand", "reorderPoint"
        FROM "Part"
        WHERE "orgId" = ${orgId} AND "onHand" <= "reorderPoint"
        ORDER BY ("reorderPoint" - "onHand") DESC
        LIMIT 50`,
  ]);

  const { items, nextCursor } = pageResult(rows, take);

  // Single-source = exactly one qualified vendor. The design-side signal lives on
  // PartMaster.approvedVendorIds (populated), bridged to the buy-side by the shared
  // code (partNumber === sku). One batched lookup for the page's parts.
  const skus = [...new Set(items.map((r) => r.part.sku))];
  const masters = skus.length
    ? await db.partMaster.findMany({
        where: { partNumber: { in: skus } },
        select: { partNumber: true, approvedVendorIds: true },
      })
    : [];
  const singleSourceBySku = new Map(
    masters.map((m) => [m.partNumber, m.approvedVendorIds.length === 1]),
  );

  const now = Date.now();
  // DEMO.6 #10 — the CONF.1-corrected confidence for every agent-drafted PO on this
  // page. The raw value is whatever the agent stated in its own `po.draft` AUDIT.1
  // entry; the map is the org's fitted model. One batched read, then a pure
  // calibration per row — an agent-drafted PO with no recorded confidence stays null
  // rather than being given a number.
  const agentCodes = items.filter((r) => r.draftedByAgentId).map((r) => r.code);
  const draftByCode = new Map<string, { model: string; confidence: number }>();
  if (agentCodes.length) {
    const drafts = await db.auditLog.findMany({
      where: {
        actorType: "AGENT",
        targetType: "PurchaseOrder",
        targetId: { in: agentCodes },
        confidence: { not: null },
      },
      orderBy: { createdAt: "asc" },
      select: { targetId: true, model: true, confidence: true },
    });
    for (const d of drafts) {
      if (!d.model || d.confidence == null || draftByCode.has(d.targetId))
        continue;
      draftByCode.set(d.targetId, {
        model: d.model,
        confidence: d.confidence,
      });
    }
  }
  const calModel = draftByCode.size ? await getCalibrationModel(orgId) : null;

  const pos: QueuePO[] = items.map((r) => ({
    id: r.id,
    code: r.code,
    status: r.status,
    qty: r.qty,
    value: r.value,
    eta: r.eta,
    receivedAt: r.receivedAt,
    supplier: r.supplier.name,
    partSku: r.part.sku,
    draftedByAgentId: r.draftedByAgentId,
    agentDrafted: r.draftedByAgentId !== null,
    agentConfidence: (() => {
      const d = draftByCode.get(r.code);
      if (!d) return null;
      const cal = calibratedConfidence(d.confidence, calModel);
      return {
        calibrated: Math.round(cal.value * 100) / 100,
        raw: Math.round(d.confidence * 100) / 100,
        state: cal.state,
        model: d.model,
      };
    })(),
    late:
      r.status !== "RECEIVED" &&
      r.status !== "REJECTED" &&
      r.eta !== null &&
      r.eta.getTime() < now,
    longLead: r.part.leadDays >= LONG_LEAD_DAYS,
    singleSource: singleSourceBySku.get(r.part.sku) ?? false,
  }));

  return { pos, nextCursor, reorderCandidates };
}

/** Paginated supplier list (read-only). */
export async function listSuppliers(
  orgId: string,
  opts: { cursor?: string; take?: number } = {},
) {
  const take = opts.take ?? 50;
  const rows = await dbForOrg(orgId).supplier.findMany({
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: {
      id: true,
      name: true,
      tier: true,
      riskScore: true,
      onTimePct: true,
    },
  });
  return pageResult(rows, take);
}

/** Paginated part list (read-only). */
export async function listParts(
  orgId: string,
  opts: { cursor?: string; take?: number } = {},
) {
  const take = opts.take ?? 50;
  const rows = await dbForOrg(orgId).part.findMany({
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: {
      id: true,
      sku: true,
      name: true,
      onHand: true,
      reorderPoint: true,
      leadDays: true,
    },
  });
  return pageResult(rows, take);
}

// ── DEMO — the PO DETAIL surface (warehouse beats 2 & 3) ─────────────────────────
//
// The live dry-run caught the /procurement beats OVER-CLAIMING: the script says one PO
// is "being chased automatically" and another was "3-way matched, 6 of 6, serial
// captured", but clicking a row only highlighted it. The claims were true of the DATA
// and invisible in the PRODUCT — the worst version, because it reads as vapour exactly
// when someone leans in.
//
// Both are read from what already exists: the agent's action is the AUDIT.1 entry it
// wrote (inputs · output · model · confidence · approver), and the receipt match is the
// extraction the goods-receipt agent stored on the packing-list File. Nothing here
// computes a new number — if a field is absent the surface says so rather than
// inventing it, which is the whole point of showing the audit trail at all.

/** One AUDIT.1 entry as the detail surface renders it. */
export interface PoAuditEntry {
  id: string;
  at: Date;
  actorType: string;
  actorLabel: string;
  action: string;
  summary: string;
  /** AUDIT.1's four accountability fields — null when the actor was human. */
  model: string | null;
  confidence: number | null;
  approverLabel: string | null;
}

/** The goods-receipt 3-way match, as the receiving agent recorded it. */
export interface ThreeWayMatch {
  poQty: number;
  packingListQty: number | null;
  invoiceCode: string | null;
  invoiceAmount: number | null;
  matched: boolean;
  /** serials captured into genealogy at receipt. */
  serials: string[];
  sku: string | null;
  sourceFile: string | null;
}

export interface PoDetail {
  code: string;
  status: POStatus;
  qty: number;
  value: number;
  supplier: string;
  partSku: string;
  eta: Date | null;
  receivedAt: Date | null;
  /** whole days past the promised date, when late and not yet received. */
  daysLate: number | null;
  audit: PoAuditEntry[];
  threeWay: ThreeWayMatch | null;
}

/**
 * Everything the PO detail surface shows, org-scoped. Read-only; returns null when the
 * code is not this tenant's (so a focus param can never read across orgs).
 */
export async function getPoDetail(
  orgId: string,
  code: string,
): Promise<PoDetail | null> {
  const db = dbForOrg(orgId);
  const po = await db.purchaseOrder.findFirst({
    where: { code },
    select: {
      code: true,
      status: true,
      qty: true,
      value: true,
      eta: true,
      receivedAt: true,
      supplier: { select: { name: true } },
      part: { select: { sku: true } },
    },
  });
  if (!po) return null;

  const entries = await db.auditLog.findMany({
    where: { targetType: "PurchaseOrder", targetId: code },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      createdAt: true,
      actorType: true,
      actorLabel: true,
      action: true,
      summary: true,
      model: true,
      confidence: true,
      approverLabel: true,
    },
  });

  const daysLate =
    po.eta && !po.receivedAt && po.eta.getTime() < Date.now()
      ? Math.floor((Date.now() - po.eta.getTime()) / 86_400_000)
      : null;

  // The 3-way match is only meaningful once goods are in. Read it from the packing
  // list the receiving agent extracted — never recomputed here, so the screen shows
  // what the agent actually recorded.
  let threeWay: ThreeWayMatch | null = null;
  if (po.status === "RECEIVED") {
    const file = await db.file.findFirst({
      where: { linkedTo: { contains: code } },
      select: { name: true, extracted: true },
    });
    const ex = (file?.extracted ?? null) as {
      invoice?: string;
      threeWayMatch?: boolean;
      lineItems?: { sku?: string; qty?: number; serials?: string[] }[];
    } | null;
    if (ex) {
      const line = ex.lineItems?.[0] ?? null;
      const invoice = ex.invoice
        ? await db.invoice.findFirst({
            where: { code: ex.invoice },
            select: { code: true, amount: true },
          })
        : null;
      threeWay = {
        poQty: po.qty,
        packingListQty: line?.qty ?? null,
        invoiceCode: ex.invoice ?? null,
        invoiceAmount: invoice?.amount ?? null,
        matched: ex.threeWayMatch === true,
        serials: line?.serials ?? [],
        sku: line?.sku ?? null,
        sourceFile: file?.name ?? null,
      };
    }
  }

  return {
    code: po.code,
    status: po.status,
    qty: po.qty,
    value: po.value,
    supplier: po.supplier?.name ?? "—",
    partSku: po.part?.sku ?? "—",
    eta: po.eta,
    receivedAt: po.receivedAt,
    daysLate,
    audit: entries.map((e) => ({
      id: e.id,
      at: e.createdAt,
      actorType: e.actorType,
      actorLabel: e.actorLabel,
      action: e.action,
      summary: e.summary,
      model: e.model,
      confidence: e.confidence,
      approverLabel: e.approverLabel,
    })),
    threeWay,
  };
}
