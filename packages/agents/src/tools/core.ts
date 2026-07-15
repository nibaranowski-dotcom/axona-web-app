import { z } from "zod";
import { search } from "@axona/db";
import type { Tool } from "../runtime/types";
import { getBlastRadiusTool } from "./ontology";
import { recallMemoryTool } from "./memory";

// Core (cross-module) read tools. Every module agent gets these in addition to
// its own set; the core/Axona agent gets ONLY these (reads everything, acts on
// nothing directly).

export const searchOperations: Tool<{ query: string }> = {
  name: "searchOperations",
  category: "read",
  description:
    "Search across modules, agents, projects, and files for this org. Use to locate records or correlate across modules before answering.",
  inputSchema: z.object({ query: z.string().min(1) }),
  handler: async ({ query }, ctx) => {
    const res = await search(ctx.orgId, query, { limit: 10 });
    return {
      results: res.hits.map((h) => ({
        type: h.type,
        title: h.title,
        url: h.url,
      })),
      // Citation refs (GA.1): real object routes only — never fabricated. The
      // chat route gathers `sources` from tool-results → Message.citations.
      sources: res.hits.map((h) => ({ label: h.title, url: h.url })),
    };
  },
};

export const getModuleSummary: Tool<{ moduleKey: string }> = {
  name: "getModuleSummary",
  category: "read",
  description:
    "Counts of key records for a module (agents, open NCRs, drafted POs) — a quick cross-module status read.",
  inputSchema: z.object({ moduleKey: z.string().min(1) }),
  handler: async ({ moduleKey }, ctx) => {
    const [agents, openNcrs, draftedPOs] = await Promise.all([
      ctx.db.agent.count({ where: { moduleKey } }),
      ctx.db.nCR.count({ where: { NOT: { status: "CLOSED" } } }),
      ctx.db.purchaseOrder.count({ where: { status: "DRAFTED" } }),
    ]);
    return { moduleKey, agents, openNcrs, draftedPOs };
  },
};

export const coreTools: Tool[] = [
  searchOperations as Tool,
  getModuleSummary as Tool,
  // MEM.1 wiring-gap fix: the cross-module graph + memory reads live in coreTools
  // so the Axona agent RELIABLY carries them (not only via the category filter),
  // and every module co-pilot gets them through coreReadTools(). Each is registered
  // ONCE here (not also in a module list) so readToolsAcrossModules() stays free of
  // duplicate tool names.
  getBlastRadiusTool as Tool, // ONT.1 — cross-module blast radius
  recallMemoryTool as Tool, // MEM.1 — recall prior episodes
];
