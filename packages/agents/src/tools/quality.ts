import { z } from "zod";
import type { Tool } from "../runtime/types";
import { LIST_CAP, genCode } from "./util";

// Quality — reads + drafting an NCR runs autonomously (opening a defect record
// is the agent's job; it commits nothing irreversible).

/** Loose-match a display characteristic to a stored key: lowercase, strip
 *  non-alphanumerics ("Drive torque" → "drivetorque" ⊂ "drivetorquenm"). */
const normChar = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export const runSpcCheck: Tool<{ characteristic: string }> = {
  name: "runSpcCheck",
  category: "read",
  description:
    "Check recent SPC samples for a characteristic against control limits; flags any value outside [LCL, UCL]. Accepts the display name ('Drive torque') or the stored key; surfaces the linked NCR when a breach is on record.",
  inputSchema: z.object({ characteristic: z.string().min(1) }),
  handler: async ({ characteristic }, ctx) => {
    // ONT.1 fix: the SPC chart labels a series "Drive torque" but the stored
    // `characteristic` is "drive_torque_Nm" — an exact-match query found 0 rows
    // while the chart showed 24/2-breach. Resolve the loose/display name to the
    // real stored key first (take/predicate were already correct).
    const distinct = await ctx.db.spcSample.findMany({
      select: { characteristic: true },
      distinct: ["characteristic"],
      orderBy: { characteristic: "asc" }, // VERIFY.3 — stable loose-name resolution
    });
    const target = normChar(characteristic);
    const key =
      distinct.find((d) => {
        const n = normChar(d.characteristic);
        return n === target || n.includes(target) || target.includes(n);
      })?.characteristic ?? characteristic;

    const samples = await ctx.db.spcSample.findMany({
      where: { characteristic: key },
      orderBy: { ts: "desc" },
      take: LIST_CAP,
    });
    const breaches = samples.filter((s) => s.value > s.ucl || s.value < s.lcl);

    // Surface the NCR the breach is linked to, via the ONT.1 graph.
    let linkedNcr: { code: string; defect: string; status: string } | null =
      null;
    if (breaches.length > 0) {
      const sampleIds = breaches.map((b) => b.id);
      const links = await ctx.db.entityLink.findMany({
        where: {
          OR: [
            { toType: "SPC_SAMPLE", toId: { in: sampleIds }, fromType: "NCR" },
            {
              fromType: "SPC_SAMPLE",
              fromId: { in: sampleIds },
              toType: "NCR",
            },
          ],
        },
        orderBy: { id: "asc" }, // VERIFY.3 — `links[0]` must not be heap order
      });
      const link = links[0];
      const ncrId = link
        ? link.fromType === "NCR"
          ? link.fromId
          : link.toId
        : null;
      if (ncrId) {
        const ncr = await ctx.db.nCR.findUnique({ where: { id: ncrId } });
        if (ncr)
          linkedNcr = {
            code: ncr.code,
            defect: ncr.defect,
            status: ncr.status,
          };
      }
    }

    return {
      characteristic: key,
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
      linkedNcr,
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
  // getBlastRadiusTool moved to coreTools in MEM.1 (the wiring-gap fix) — the
  // Quality agent still gets it via coreReadTools(), now WITHOUT duplicating it in
  // readToolsAcrossModules() (which would collide the tool name for the Axona agent).
];
