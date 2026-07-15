import { z } from "zod";
import { recallMemory } from "@axona/db";
import type { Tool } from "../runtime/types";

// MEM.1 — the operational-memory recall tool. Wraps recallMemory (the hybrid
// vector ⊕ graph-proximity ⊕ recency retrieval in @axona/db). READ-only. Wired
// into registry.coreTools so the Axona agent (and every module co-pilot, via
// coreReadTools) can recall a PRIOR episode when reasoning about a current one —
// the memory node of the loop. Real records + provenance only; the agent cites them.

const ENTITY_TYPES = [
  "NCR",
  "ECO",
  "PART",
  "SUPPLIER",
  "PURCHASE_ORDER",
  "UNIT",
  "LOT",
  "DELIVERY",
  "WORK_ORDER",
  "SPC_SAMPLE",
  "INVOICE",
] as const;

export const recallMemoryTool: Tool<{
  query?: string;
  subjectType?: (typeof ENTITY_TYPES)[number];
  subjectId?: string;
  kind?: string;
  limit?: number;
}> = {
  name: "recallMemory",
  category: "read",
  description:
    "Recall prior operational EPISODES (past decisions, exceptions, approvals, resolutions) relevant to a situation — a hybrid of semantic similarity AND entity-graph proximity (memories anchored to related parts/suppliers/units/ECOs), plus recency. Pass `query` (the situation text) and/or a subject (`subjectType`+`subjectId`, e.g. an NCR) to pull what happened to it and its neighborhood. Returns real records with outcome + provenance — cite them. Use this to answer 'have we seen this before, and how was it handled?'.",
  inputSchema: z.object({
    query: z.string().optional(),
    subjectType: z.enum(ENTITY_TYPES).optional(),
    subjectId: z.string().optional(),
    kind: z.string().optional(),
    limit: z.number().int().min(1).max(25).optional(),
  }),
  handler: async (input, ctx) => {
    const hits = await recallMemory(ctx.db, input);
    return {
      count: hits.length,
      episodes: hits.map((h) => ({
        summary: h.summary,
        kind: h.kind,
        outcome: h.outcome,
        subject: h.subject ? `${h.subject.code} · ${h.subject.label}` : null,
        occurredAt: h.occurredAt,
        approver: h.approverLabel,
        actor: h.actorLabel,
        via: h.via.graph
          ? h.via.vector
            ? "similarity + graph"
            : "graph proximity"
          : "similarity",
      })),
      // Citation refs (GA.1): the anchor record's route, real objects only.
      sources: hits
        .filter((h) => h.subject)
        .map((h) => ({
          label: h.subject!.code,
          url: subjectUrl(h.subject!.type, h.subject!.code),
        })),
    };
  },
};

// Best-effort route for a subject's module (citation link target).
function subjectUrl(type: string, _code: string): string {
  switch (type) {
    case "NCR":
    case "SPC_SAMPLE":
      return "/quality";
    case "ECO":
      return "/engineering";
    case "PART":
    case "SUPPLIER":
    case "PURCHASE_ORDER":
      return "/procurement";
    case "UNIT":
    case "LOT":
      return "/manufacturing";
    case "DELIVERY":
      return "/fulfillment";
    case "WORK_ORDER":
      return "/field-service";
    case "INVOICE":
      return "/finance";
    default:
      return "/core";
  }
}
