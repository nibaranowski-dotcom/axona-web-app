import type { FinanceInvoice } from "@/lib/finance";

// Finance display helpers (FIN.2). Money in $M / $k; AR aging by a pill (overdue
// = ink, due-soon = lime, current = neutral-green). Brand palette only.

export function fmtMoney(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${Math.round(abs / 1e3)}k`;
  return `${sign}$${Math.round(abs)}`;
}

export function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "2026-06" → "Jun"; falls back to the raw period. */
export function periodLabel(period: string): string {
  const m = period.match(/^\d{4}-(\d{2})$/);
  if (m) return MONTHS[Number(m[1]) - 1] ?? period;
  return period;
}

export type AgingTone = "over" | "soon" | "current";

export function agingLabel(
  inv: FinanceInvoice,
  now: number,
): { text: string; tone: AgingTone } {
  if (inv.overdue) return { text: `${inv.daysOverdue}d overdue`, tone: "over" };
  if (inv.dueDate) {
    const days = Math.ceil(
      (new Date(inv.dueDate).getTime() - now) / 86_400_000,
    );
    if (days >= 0 && days <= 14) return { text: `Due ${days}d`, tone: "soon" };
  }
  return { text: "Current", tone: "current" };
}

// AA-safe: ink text on the tinted/lime chips (green-on-tint would fail).
export const AGING_BADGE: Record<AgingTone, string> = {
  over: "bg-ink-strong text-on-dark",
  soon: "bg-accent text-accent-ink",
  current: "bg-success-tint text-ink",
};
