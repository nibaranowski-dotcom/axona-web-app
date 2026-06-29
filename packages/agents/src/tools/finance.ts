import { z } from "zod";
import type { Tool } from "../runtime/types";
import { LIST_CAP } from "./util";

// Finance — reads run freely; recognizing revenue and issuing a credit note are
// irreversible money actions and are gated (proposed only).

export const getUnitEconomics: Tool<Record<string, never>> = {
  name: "getUnitEconomics",
  category: "read",
  description: "Per-product unit economics (ASP, COGS, margin %, trend).",
  inputSchema: z.object({}),
  handler: async (_input, ctx) => {
    const rows = await ctx.db.unitEconomic.findMany({ take: LIST_CAP });
    return rows.map((u) => ({
      product: u.product,
      asp: u.asp,
      cogs: u.cogs,
      marginPct: u.marginPct,
      trend: u.trend,
    }));
  },
};

export const getArAging: Tool<Record<string, never>> = {
  name: "getArAging",
  category: "read",
  description:
    "Accounts-receivable aging — open invoices with days overdue (negative = not yet due).",
  inputSchema: z.object({}),
  handler: async (_input, ctx) => {
    const invoices = await ctx.db.invoice.findMany({
      where: { NOT: { status: "PAID" } },
      take: LIST_CAP,
    });
    const now = new Date().getTime();
    return invoices.map((inv) => ({
      code: inv.code,
      account: inv.account,
      amount: inv.amount,
      status: inv.status,
      daysOverdue: inv.dueDate
        ? Math.round((now - inv.dueDate.getTime()) / 86_400_000)
        : null,
    }));
  },
};

export const recognizeRevenue: Tool<{ invoiceId: string }> = {
  name: "recognizeRevenue",
  category: "gated",
  gated: true,
  description:
    "Recognize revenue for an invoice (books it to the ledger). Requires human approval.",
  inputSchema: z.object({ invoiceId: z.string().min(1) }),
  // Human-approved path (RBAC.4); the autonomous loop never calls this.
  handler: async (i, ctx) => {
    const res = await ctx.db.invoice.updateMany({
      where: { id: i.invoiceId },
      data: { status: "RECOGNIZED" },
    });
    return { invoiceId: i.invoiceId, status: "RECOGNIZED", updated: res.count };
  },
};

export const issueCreditNote: Tool<{
  account: string;
  amount: number;
  period: string;
}> = {
  name: "issueCreditNote",
  category: "gated",
  gated: true,
  description:
    "Issue a credit note against an account (reduces receivable). Requires human approval.",
  inputSchema: z.object({
    account: z.string().min(1),
    amount: z.number().positive(),
    period: z.string().min(1),
  }),
  // Human-approved path (RBAC.4); the autonomous loop never calls this.
  handler: async (i, ctx) => {
    const entry = await ctx.db.ledgerEntry.create({
      data: {
        orgId: ctx.orgId,
        period: i.period,
        account: i.account,
        amount: -Math.abs(i.amount),
        kind: "CREDIT_NOTE",
      },
    });
    return { id: entry.id, account: entry.account, amount: entry.amount };
  },
};

export const financeTools: Tool[] = [
  getUnitEconomics as Tool,
  getArAging as Tool,
  recognizeRevenue as Tool,
  issueCreditNote as Tool,
];
