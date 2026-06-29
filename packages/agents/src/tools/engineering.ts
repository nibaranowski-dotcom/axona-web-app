import { z } from "zod";
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

export const engineeringTools: Tool[] = [
  getEco as Tool,
  getCompatMatrix as Tool,
  draftEco as Tool,
  releaseEco as Tool,
];
