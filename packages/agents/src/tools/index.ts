import { z } from "zod";
import { search } from "@axona/db";
import type { AgentDef, Tool } from "../runtime/types";

// Example tools to prove the loop — read-only + ONE gated stub. The full typed
// registry over the data model (draftPurchaseOrder real mutation, openNCR,
// routeTechnician, runSpcCheck, recognizeRevenue, …) is ART.2.

export const searchOperations: Tool<{ query: string }> = {
  name: "searchOperations",
  description:
    "Search across modules, agents, projects, and files for this org. Use to locate records before answering.",
  inputSchema: z.object({ query: z.string().min(1) }),
  handler: async ({ query }, ctx) => {
    const res = await search(ctx.orgId, query, { limit: 10 });
    return res.hits.map((h) => ({ type: h.type, title: h.title, url: h.url }));
  },
};

export const getPartStatus: Tool<{ sku: string }> = {
  name: "getPartStatus",
  description: "Get on-hand quantity vs reorder point for a part by SKU.",
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

export const listOpenNcrs: Tool<Record<string, never>> = {
  name: "listOpenNcrs",
  description: "List open non-conformance reports (NCRs) for this org.",
  inputSchema: z.object({}),
  handler: async (_input, ctx) => {
    const ncrs = await ctx.db.nCR.findMany({
      where: { NOT: { status: "CLOSED" } },
      take: 20,
    });
    return ncrs.map((n) => ({
      code: n.code,
      defect: n.defect,
      severity: n.severity,
      status: n.status,
    }));
  },
};

// Gated stub (money action). The runtime PROPOSES this and stops — it never
// auto-executes, so no PurchaseOrder is created. The real mutation + approval
// state machine are ART.2 / RBAC.4 / AUDIT.3.
export const draftPurchaseOrder: Tool<{ sku: string; qty: number }> = {
  name: "draftPurchaseOrder",
  description:
    "Draft a purchase order for a part. Requires human approval before anything is ordered.",
  gated: true,
  inputSchema: z.object({
    sku: z.string().min(1),
    qty: z.number().int().positive(),
  }),
  handler: async () => {
    // Defense in depth: the loop returns at the gating check before calling this.
    throw new Error("gated tool must not execute directly");
  },
};

export const ALL_TOOLS: Tool[] = [
  searchOperations as Tool,
  getPartStatus as Tool,
  listOpenNcrs as Tool,
  draftPurchaseOrder as Tool,
];

/**
 * Module → tool list. The full per-module mapping is ART.2; for now every agent
 * gets the example read-only tools plus the gated PO stub.
 */
export function toolsForModule(_moduleKey: string): Tool[] {
  return ALL_TOOLS;
}

/** Test helper (exported for verify): build an AgentDef from tool names. */
export function testDef(toolNames: string[]): AgentDef {
  return {
    systemPrompt: "test agent",
    tools: ALL_TOOLS.filter((t) => toolNames.includes(t.name)),
    scope: "test",
  };
}
