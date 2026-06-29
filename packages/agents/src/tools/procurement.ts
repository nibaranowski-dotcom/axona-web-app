import { z } from "zod";
import type { Tool } from "../runtime/types";
import { LIST_CAP, genCode } from "./util";

// Procurement — the wedge. The guardrail line: drafting a PO runs autonomously
// (→ DRAFTED); SENDING it (commits spend) is gated and only ever proposed.

export const getPartStatus: Tool<{ sku: string }> = {
  name: "getPartStatus",
  category: "read",
  description: "On-hand quantity vs reorder point for a part by SKU.",
  inputSchema: z.object({ sku: z.string().min(1) }),
  handler: async ({ sku }, ctx) => {
    const part = await ctx.db.part.findFirst({ where: { sku } });
    if (!part) return { sku, found: false };
    return {
      sku,
      name: part.name,
      onHand: part.onHand,
      reorderPoint: part.reorderPoint,
      belowReorder: part.onHand < part.reorderPoint,
    };
  },
};

export const listReorderCandidates: Tool<Record<string, never>> = {
  name: "listReorderCandidates",
  category: "read",
  description: "Parts at or below their reorder point (most-depleted first).",
  inputSchema: z.object({}),
  handler: async (_input, ctx) => {
    // Prisma can't compare two columns; use $queryRaw. The extension does NOT
    // scope raw SQL, so we pin orgId ourselves (parameterized).
    const rows = await ctx.db.$queryRaw<
      {
        id: string;
        sku: string;
        name: string;
        onHand: number;
        reorderPoint: number;
      }[]
    >`SELECT id, sku, name, "onHand", "reorderPoint"
        FROM "Part"
        WHERE "orgId" = ${ctx.orgId} AND "onHand" <= "reorderPoint"
        ORDER BY ("reorderPoint" - "onHand") DESC
        LIMIT ${LIST_CAP}`;
    return rows;
  },
};

export const getSupplierRisk: Tool<{ supplierId: string }> = {
  name: "getSupplierRisk",
  category: "read",
  description: "Risk score, tier, and on-time % for a supplier.",
  inputSchema: z.object({ supplierId: z.string().min(1) }),
  handler: async ({ supplierId }, ctx) => {
    const s = await ctx.db.supplier.findFirst({ where: { id: supplierId } });
    if (!s) return { supplierId, found: false };
    return {
      supplierId,
      name: s.name,
      tier: s.tier,
      riskScore: s.riskScore,
      onTimePct: s.onTimePct,
    };
  },
};

export const draftPurchaseOrder: Tool<{
  partId: string;
  supplierId: string;
  qty: number;
}> = {
  name: "draftPurchaseOrder",
  category: "draft",
  description:
    "Draft a purchase order (status DRAFTED) for a part from a supplier. Does NOT send it — a human approves sending.",
  inputSchema: z.object({
    partId: z.string().min(1),
    supplierId: z.string().min(1),
    qty: z.number().int().positive(),
  }),
  handler: async (i, ctx) => {
    const po = await ctx.db.purchaseOrder.create({
      data: {
        orgId: ctx.orgId,
        code: genCode("PO"),
        partId: i.partId,
        supplierId: i.supplierId,
        qty: i.qty,
        value: 0,
        status: "DRAFTED",
        draftedByAgentId: ctx.agentId,
      },
    });
    return { id: po.id, code: po.code, status: po.status, qty: po.qty };
  },
};

export const sendPurchaseOrder: Tool<{ poId: string }> = {
  name: "sendPurchaseOrder",
  category: "gated",
  gated: true,
  description:
    "Send/place a drafted purchase order with a supplier (commits spend). Requires human approval.",
  inputSchema: z.object({ poId: z.string().min(1) }),
  // The human-approved path (RBAC.4). The autonomous loop NEVER calls this —
  // ART.1's gate proposes it and stops. updateMany keeps it tenant-scoped.
  handler: async (i, ctx) => {
    const res = await ctx.db.purchaseOrder.updateMany({
      where: { id: i.poId },
      data: { status: "SENT" },
    });
    return { poId: i.poId, status: "SENT", updated: res.count };
  },
};

export const procurementTools: Tool[] = [
  getPartStatus as Tool,
  listReorderCandidates as Tool,
  getSupplierRisk as Tool,
  draftPurchaseOrder as Tool,
  sendPurchaseOrder as Tool,
];
