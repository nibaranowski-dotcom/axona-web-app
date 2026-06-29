import { z } from "zod";
import type { Tool } from "../runtime/types";
import { LIST_CAP } from "./util";

// Field Service — reads + routing a technician is a reversible draft assignment
// (non-gated). Nothing here commits money/safety/contract.

export const getWorkOrder: Tool<{ code: string }> = {
  name: "getWorkOrder",
  category: "read",
  description:
    "Get a field work order by code (site, issue, status, SLA, assigned tech).",
  inputSchema: z.object({ code: z.string().min(1) }),
  handler: async ({ code }, ctx) => {
    const wo = await ctx.db.workOrderField.findFirst({ where: { code } });
    if (!wo) return { code, found: false };
    return {
      code: wo.code,
      site: wo.site,
      issue: wo.issue,
      status: wo.status,
      severity: wo.severity,
      slaDueAt: wo.slaDueAt,
      techId: wo.techId,
    };
  },
};

export const findCertifiedTech: Tool<{ site: string }> = {
  name: "findCertifiedTech",
  category: "read",
  description: "Find available technicians at a site (with their certs).",
  inputSchema: z.object({ site: z.string().min(1) }),
  handler: async ({ site }, ctx) => {
    const techs = await ctx.db.technician.findMany({
      where: { site },
      take: LIST_CAP,
    });
    return techs.map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      certs: t.certs,
    }));
  },
};

export const getSlaCountdown: Tool<{ code: string }> = {
  name: "getSlaCountdown",
  category: "read",
  description:
    "Hours remaining until a work order's SLA due time (negative = breached).",
  inputSchema: z.object({ code: z.string().min(1) }),
  handler: async ({ code }, ctx) => {
    const wo = await ctx.db.workOrderField.findFirst({ where: { code } });
    if (!wo) return { code, found: false };
    if (!wo.slaDueAt) return { code, slaDueAt: null, hoursRemaining: null };
    const hoursRemaining =
      (wo.slaDueAt.getTime() - new Date().getTime()) / 3_600_000;
    return {
      code,
      slaDueAt: wo.slaDueAt,
      hoursRemaining: Math.round(hoursRemaining),
    };
  },
};

export const routeTechnician: Tool<{ workOrderId: string; techId: string }> = {
  name: "routeTechnician",
  category: "draft",
  description:
    "Assign (draft) a technician to a work order. Reversible scheduling — not gated.",
  inputSchema: z.object({
    workOrderId: z.string().min(1),
    techId: z.string().min(1),
  }),
  handler: async (i, ctx) => {
    const res = await ctx.db.workOrderField.updateMany({
      where: { id: i.workOrderId },
      data: { techId: i.techId, status: "ASSIGNED" },
    });
    return { workOrderId: i.workOrderId, techId: i.techId, updated: res.count };
  },
};

export const fieldServiceTools: Tool[] = [
  getWorkOrder as Tool,
  findCertifiedTech as Tool,
  getSlaCountdown as Tool,
  routeTechnician as Tool,
];
