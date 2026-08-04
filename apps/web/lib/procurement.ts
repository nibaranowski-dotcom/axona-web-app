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
