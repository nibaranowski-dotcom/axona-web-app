import { z } from "zod";
import { compareConfigVersions } from "@axona/db";
import type { Tool } from "../runtime/types";
import { LIST_CAP, genCode } from "./util";

// Engineering — drafting an ECO runs autonomously; RELEASING it (locks a design
// change into production) is gated.

export const getEco: Tool<{ code: string }> = {
  name: "getEco",
  category: "read",
  description: "Get an engineering change order (ECO) by code, with its stage.",
  inputSchema: z.object({ code: z.string().min(1) }),
  handler: async ({ code }, ctx) => {
    const eco = await ctx.db.eCO.findFirst({ where: { code } });
    if (!eco) return { code, found: false };
    return {
      code: eco.code,
      title: eco.title,
      changeType: eco.changeType,
      affected: eco.affected,
      stage: eco.stage,
    };
  },
};

export const getCompatMatrix: Tool<{ hwRev: string }> = {
  name: "getCompatMatrix",
  category: "read",
  description:
    "Hardware/firmware compatibility states for a hardware revision.",
  inputSchema: z.object({ hwRev: z.string().min(1) }),
  handler: async ({ hwRev }, ctx) => {
    const cells = await ctx.db.compatCell.findMany({
      where: { hwRev },
      take: LIST_CAP,
    });
    return cells.map((c) => ({ fwVersion: c.fwVersion, state: c.state }));
  },
};

export const draftEco: Tool<{
  title: string;
  changeType: string;
  affected: string;
}> = {
  name: "draftEco",
  category: "draft",
  description:
    "Draft an engineering change order (stage DRAFT). Does NOT release it — releasing is gated.",
  inputSchema: z.object({
    title: z.string().min(1),
    changeType: z.string().min(1),
    affected: z.string().min(1),
  }),
  handler: async (i, ctx) => {
    const eco = await ctx.db.eCO.create({
      data: {
        orgId: ctx.orgId,
        code: genCode("ECO"),
        title: i.title,
        changeType: i.changeType,
        affected: i.affected,
        stage: "DRAFT",
      },
    });
    return { code: eco.code, stage: eco.stage };
  },
};

export const releaseEco: Tool<{ code: string }> = {
  name: "releaseEco",
  category: "gated",
  gated: true,
  description:
    "Release an ECO into production (locks the change across affected units). Requires human approval.",
  inputSchema: z.object({ code: z.string().min(1) }),
  // Human-approved path (RBAC.4); the autonomous loop never calls this.
  handler: async (i, ctx) => {
    const res = await ctx.db.eCO.updateMany({
      where: { code: i.code },
      data: { stage: "RELEASED" },
    });
    return { code: i.code, stage: "RELEASED", updated: res.count };
  },
};

// SRCH/AGT — the config COMPARISON as a first-class tool.
//
// Asked "what changed between CFG-X and CFG-Y", the agent previously had only
// full-text search. That query ANDs its terms, so "changed"/"between" matched no
// document, search returned nothing, and the agent looped re-searching until it hit
// the turn cap and returned "Run exceeded the turn limit." — no answer at all, on a
// question whose answer was sitting in two rows.
//
// A positional delta between two baselines is a PLM primitive, not a search result.
// This reuses the SAME `compareConfigVersions` the /configurations screen renders
// (lifted into @axona/db for exactly that reason), so the agent and the screen can
// never disagree about what changed. Org-scoped through that function; unknown names
// return found:false rather than an empty diff, so the agent says "no such baseline"
// instead of "nothing changed".
export const compareConfigurations: Tool<{ codeA: string; codeB: string }> = {
  name: "compareConfigurations",
  category: "read",
  description:
    "Compare two configuration versions/baselines by code (e.g. CFG-A vs CFG-B) and " +
    "return the positional hardware and software delta between them. Use this for any " +
    "question about what CHANGED, DIFFERS or was UPGRADED between two configurations " +
    "or baselines — do not use search for that.",
  inputSchema: z.object({
    codeA: z.string().min(1),
    codeB: z.string().min(1),
  }),
  handler: async ({ codeA, codeB }, ctx) => {
    const diff = await compareConfigVersions(ctx.orgId, codeA, codeB);
    if (!diff)
      return {
        found: false,
        codeA,
        codeB,
        note: "One or both configuration versions do not exist in this tenant.",
      };
    const changed = [
      ...diff.hw.filter((r) => r.differs).map((r) => ({ ...r, kind: "hw" })),
      ...diff.sw.filter((r) => r.differs).map((r) => ({ ...r, kind: "sw" })),
    ];
    return {
      found: true,
      a: diff.a,
      b: diff.b,
      changedCount: changed.length,
      // Only the positions that actually differ — the unchanged rows are noise in a
      // "what changed" answer and would crowd the model's context.
      changed: changed.map((r) => ({
        kind: r.kind,
        position: r.key,
        [diff.a]: r.a ?? "(absent)",
        [diff.b]: r.b ?? "(absent)",
      })),
      unchangedCount:
        diff.hw.filter((r) => !r.differs).length +
        diff.sw.filter((r) => !r.differs).length,
    };
  },
};

export const engineeringTools: Tool[] = [
  getEco as Tool,
  getCompatMatrix as Tool,
  draftEco as Tool,
  releaseEco as Tool,
  compareConfigurations as Tool,
];
