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

export interface QueuePO {
  id: string;
  code: string;
  status: POStatus;
  qty: number;
  value: number;
  eta: Date | null;
  supplier: string; // resolved from supplierId
  partSku: string; // resolved from partId
  draftedByAgentId: string | null;
  agentDrafted: boolean;
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
        draftedByAgentId: true,
        supplier: { select: { name: true } },
        part: { select: { sku: true } },
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
  const pos: QueuePO[] = items.map((r) => ({
    id: r.id,
    code: r.code,
    status: r.status,
    qty: r.qty,
    value: r.value,
    eta: r.eta,
    supplier: r.supplier.name,
    partSku: r.part.sku,
    draftedByAgentId: r.draftedByAgentId,
    agentDrafted: r.draftedByAgentId !== null,
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
