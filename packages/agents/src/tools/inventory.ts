import { z } from "zod";
import type { Tool } from "../runtime/types";

// Inventory — read-only stock lookups.

export const getStock: Tool<{ sku: string }> = {
  name: "getStock",
  category: "read",
  description: "On-hand stock, reorder point, and lead time for a part by SKU.",
  inputSchema: z.object({ sku: z.string().min(1) }),
  handler: async ({ sku }, ctx) => {
    const part = await ctx.db.part.findFirst({ where: { sku } });
    if (!part) return { sku, found: false };
    return {
      sku,
      name: part.name,
      onHand: part.onHand,
      reorderPoint: part.reorderPoint,
      leadDays: part.leadDays,
    };
  },
};

export const inventoryTools: Tool[] = [getStock as Tool];
