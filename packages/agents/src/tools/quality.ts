import { z } from "zod";
import type { Tool } from "../runtime/types";
import { LIST_CAP, genCode } from "./util";

// Quality — reads + drafting an NCR runs autonomously (opening a defect record
// is the agent's job; it commits nothing irreversible).

export const runSpcCheck: Tool<{ characteristic: string }> = {
  name: "runSpcCheck",
  category: "read",
  description:
    "Check recent SPC samples for a characteristic against control limits; flags any value outside [LCL, UCL].",
  inputSchema: z.object({ characteristic: z.string().min(1) }),
  handler: async ({ characteristic }, ctx) => {
    const samples = await ctx.db.spcSample.findMany({
      where: { characteristic },
      orderBy: { ts: "desc" },
      take: LIST_CAP,
    });
    const breaches = samples.filter((s) => s.value > s.ucl || s.value < s.lcl);
    return {
      characteristic,
      sampled: samples.length,
      breaches: breaches.length,
      worst: breaches[0]
        ? {
            serial: breaches[0].serial,
            value: breaches[0].value,
            ucl: breaches[0].ucl,
            lcl: breaches[0].lcl,
          }
        : null,
    };
  },
};

export const listOpenNcrs: Tool<Record<string, never>> = {
  name: "listOpenNcrs",
  category: "read",
  description: "List open non-conformance reports (NCRs) for this org.",
  inputSchema: z.object({}),
  handler: async (_input, ctx) => {
    const ncrs = await ctx.db.nCR.findMany({
      where: { NOT: { status: "CLOSED" } },
      take: LIST_CAP,
    });
    return ncrs.map((n) => ({
      code: n.code,
      defect: n.defect,
      severity: n.severity,
      status: n.status,
    }));
  },
};

export const getCertStatus: Tool<{ name: string }> = {
  name: "getCertStatus",
  category: "read",
  description: "Status and validity window for a certification by name.",
  inputSchema: z.object({ name: z.string().min(1) }),
  handler: async ({ name }, ctx) => {
    const cert = await ctx.db.cert.findFirst({ where: { name } });
    if (!cert) return { name, found: false };
    return {
      name,
      scope: cert.scope,
      status: cert.status,
      validTo: cert.validTo,
    };
  },
};

export const openNcr: Tool<{
  defect: string;
  linkedTo: string;
  severity: "MINOR" | "MAJOR" | "CRITICAL";
}> = {
  name: "openNcr",
  category: "draft",
  description:
    "Open (draft) a non-conformance report for a defect. Drafting a quality record is safe and non-gated.",
  inputSchema: z.object({
    defect: z.string().min(1),
    linkedTo: z.string().min(1),
    severity: z.enum(["MINOR", "MAJOR", "CRITICAL"]),
  }),
  handler: async (i, ctx) => {
    const ncr = await ctx.db.nCR.create({
      data: {
        orgId: ctx.orgId,
        code: genCode("NCR"),
        defect: i.defect,
        linkedTo: i.linkedTo,
        severity: i.severity,
        status: "OPEN",
      },
    });
    return { code: ncr.code, status: ncr.status, severity: ncr.severity };
  },
};

export const qualityTools: Tool[] = [
  runSpcCheck as Tool,
  listOpenNcrs as Tool,
  getCertStatus as Tool,
  openNcr as Tool,
];
