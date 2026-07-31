import { dbForOrg, paginateArgs, pageResult } from "@axona/db";
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
