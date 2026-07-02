import { dbForOrg, paginateArgs, pageResult } from "@axona/db";

// FIN.1 — Finance read/API layer (build-spec §4.20, §6). Read-only over the
// existing LedgerEntry / Invoice / UnitEconomic models: no schema change, no
// mutations (the P&L / unit-economics / AR screen is FIN.2). Org-scoped via
// dbForOrg; lists paginated with the FND.11 helpers. Continues the BMW thread:
// HX-2 margin −2.1pt from ECO-318 · BMW net-60 + Kawasaki overdue.

const LEDGER_CAP = 500;
const INVOICE_CAP = 500;
const UE_CAP = 200;
const PAID = new Set(["PAID", "SETTLED", "CLOSED"]);

export type Recognition = "lumpy" | "ratable" | "other";
export type AgingBucket =
  | "current"
  | "1-30"
  | "31-60"
  | "61-90"
  | "90+"
  | "paid";

export interface RevenueStream {
  account: string;
  amount: number;
  kind: string;
  recognition: Recognition; // hardware = lumpy (at commissioning) · RaaS = ratable
  pctOfRevenue: number;
}
export interface RevenueSplit {
  total: number;
  hardware: number;
  raas: number;
  streams: RevenueStream[];
}
export interface RevenuePeriod {
  period: string;
  hardware: number; // lumpy — recognized at commissioning
  raas: number; // ratable
  total: number;
}
export interface UnitEcon {
  id: string;
  product: string;
  asp: number;
  cogs: number;
  marginPct: number;
  trend: string;
  marginDeltaPt: number | null; // parsed from trend (HX-2 = −2.1)
}
export interface FinanceInvoice {
  id: string;
  code: string;
  account: string;
  source: string;
  amount: number;
  terms: string;
  dueDate: Date | null;
  status: string;
  agingBucket: AgingBucket;
  daysOverdue: number;
  overdue: boolean;
}
export interface FinanceRollup {
  recognizedRevenue: number;
  cogs: number; // positive
  opex: number; // positive
  netIncome: number; // revenue − cogs − opex
  arTotal: number; // open + overdue receivables
  arOverdue: number;
  cash: number | null; // not in the ledger — flagged
  runwayMonths: number | null; // not derivable — flagged
}
export interface FinanceData {
  revenueSplit: RevenueSplit;
  revenueByPeriod: RevenuePeriod[]; // chronological — the two-engine chart
  unitEconomics: UnitEcon[];
  invoices: FinanceInvoice[];
  rollup: FinanceRollup;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function recognitionOf(account: string): Recognition {
  const a = account.toLowerCase();
  if (a.includes("hardware")) return "lumpy";
  if (a.includes("raas") || a.includes("subscription")) return "ratable";
  return "other";
}

function parseDeltaPt(trend: string): number | null {
  const m = trend.match(/([+-]?\d+(?:\.\d+)?)\s*pt/i);
  return m ? Number(m[1]) : null;
}

function agingOf(
  inv: { dueDate: Date | null; status: string },
  now: number,
): { agingBucket: AgingBucket; daysOverdue: number; overdue: boolean } {
  if (PAID.has(inv.status.toUpperCase()))
    return { agingBucket: "paid", daysOverdue: 0, overdue: false };
  if (!inv.dueDate) {
    const overdue = inv.status.toUpperCase() === "OVERDUE";
    return {
      agingBucket: overdue ? "1-30" : "current",
      daysOverdue: 0,
      overdue,
    };
  }
  const days = Math.floor((now - inv.dueDate.getTime()) / 86_400_000);
  if (days <= 0)
    return { agingBucket: "current", daysOverdue: 0, overdue: false };
  const agingBucket: AgingBucket =
    days <= 30 ? "1-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+";
  return { agingBucket, daysOverdue: days, overdue: true };
}

const INVOICE_SELECT = {
  id: true,
  code: true,
  account: true,
  source: true,
  amount: true,
  terms: true,
  dueDate: true,
  status: true,
} as const;

/**
 * Everything the P&L / unit-economics / AR screen (FIN.2) needs, org-scoped and
 * read-only: the revenue split (lumpy hardware recognized at commissioning vs
 * ratable RaaS), unit economics (HX-2 margin −2.1pt from ECO-318), invoices with
 * a derived AR-aging bucket (BMW net-60 current + Kawasaki overdue), and a rollup.
 */
export async function getFinanceData(orgId: string): Promise<FinanceData> {
  const db = dbForOrg(orgId);
  const now = Date.now();

  const [ledgerRows, invoiceRows, ueRows] = await Promise.all([
    db.ledgerEntry.findMany({
      take: LEDGER_CAP,
      select: { period: true, account: true, amount: true, kind: true },
    }),
    db.invoice.findMany({
      orderBy: { dueDate: "asc" },
      take: INVOICE_CAP,
      select: INVOICE_SELECT,
    }),
    db.unitEconomic.findMany({
      orderBy: { marginPct: "desc" },
      take: UE_CAP,
      select: {
        id: true,
        product: true,
        asp: true,
        cogs: true,
        marginPct: true,
        trend: true,
      },
    }),
  ]);

  // Revenue split — REVENUE ledger entries by account, with recognition.
  const revenueRows = ledgerRows.filter(
    (l) => l.kind.toUpperCase() === "REVENUE",
  );
  const total = revenueRows.reduce((s, l) => s + l.amount, 0);
  const streams: RevenueStream[] = revenueRows
    .map((l) => ({
      account: l.account,
      amount: l.amount,
      kind: l.kind,
      recognition: recognitionOf(l.account),
      pctOfRevenue: total ? round1((l.amount / total) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
  const hardware = streams
    .filter((s) => s.recognition === "lumpy")
    .reduce((s, x) => s + x.amount, 0);
  const raas = streams
    .filter((s) => s.recognition === "ratable")
    .reduce((s, x) => s + x.amount, 0);

  // Revenue by period — hardware (lumpy) + RaaS (ratable) per period, for the
  // two-engine recognition chart.
  const periodMap = new Map<
    string,
    { hardware: number; raas: number; total: number }
  >();
  for (const l of revenueRows) {
    const e = periodMap.get(l.period) ?? { hardware: 0, raas: 0, total: 0 };
    const rec = recognitionOf(l.account);
    if (rec === "lumpy") e.hardware += l.amount;
    else if (rec === "ratable") e.raas += l.amount;
    e.total += l.amount;
    periodMap.set(l.period, e);
  }
  const revenueByPeriod: RevenuePeriod[] = [...periodMap.entries()]
    .map(([period, v]) => ({ period, ...v }))
    .sort((a, b) => a.period.localeCompare(b.period));

  const cogs = Math.abs(
    ledgerRows
      .filter((l) => l.kind.toUpperCase() === "COGS")
      .reduce((s, l) => s + l.amount, 0),
  );
  const opex = Math.abs(
    ledgerRows
      .filter((l) => l.kind.toUpperCase() === "OPEX")
      .reduce((s, l) => s + l.amount, 0),
  );

  const invoices: FinanceInvoice[] = invoiceRows.map((inv) => ({
    ...inv,
    ...agingOf(inv, now),
  }));
  const receivable = invoices.filter((i) => i.agingBucket !== "paid");
  const arTotal = receivable.reduce((s, i) => s + i.amount, 0);
  const arOverdue = receivable
    .filter((i) => i.overdue)
    .reduce((s, i) => s + i.amount, 0);

  const unitEconomics: UnitEcon[] = ueRows.map((u) => ({
    ...u,
    marginDeltaPt: parseDeltaPt(u.trend),
  }));

  return {
    revenueSplit: { total, hardware, raas, streams },
    revenueByPeriod,
    unitEconomics,
    invoices,
    rollup: {
      recognizedRevenue: total,
      cogs,
      opex,
      netIncome: total - cogs - opex,
      arTotal,
      arOverdue,
      cash: null, // no cash-balance entry in the ledger — flagged (FIN.2 notes)
      runwayMonths: null, // not derivable without a burn/cash model — flagged
    },
  };
}

/** Paginated ledger list (read-only), optionally filtered by period. */
export async function listLedger(
  orgId: string,
  opts: { period?: string; cursor?: string; take?: number } = {},
) {
  const take = opts.take ?? 100;
  const rows = await dbForOrg(orgId).ledgerEntry.findMany({
    where: opts.period ? { period: opts.period } : {},
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: { id: true, period: true, account: true, amount: true, kind: true },
  });
  return pageResult(rows, take);
}

/** Paginated invoice list (read-only, with aging), optionally filtered by status. */
export async function listInvoices(
  orgId: string,
  opts: { status?: string; cursor?: string; take?: number } = {},
) {
  const take = opts.take ?? 50;
  const now = Date.now();
  const rows = await dbForOrg(orgId).invoice.findMany({
    where: opts.status ? { status: opts.status } : {},
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: INVOICE_SELECT,
  });
  const { items, nextCursor } = pageResult(rows, take);
  return {
    items: items.map((inv) => ({ ...inv, ...agingOf(inv, now) })),
    nextCursor,
  };
}

/** Paginated unit-economics list (read-only). */
export async function listUnitEconomics(
  orgId: string,
  opts: { cursor?: string; take?: number } = {},
) {
  const take = opts.take ?? 50;
  const rows = await dbForOrg(orgId).unitEconomic.findMany({
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: {
      id: true,
      product: true,
      asp: true,
      cogs: true,
      marginPct: true,
      trend: true,
    },
  });
  const { items, nextCursor } = pageResult(rows, take);
  return {
    items: items.map((u) => ({ ...u, marginDeltaPt: parseDeltaPt(u.trend) })),
    nextCursor,
  };
}
