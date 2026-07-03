import type { Deliverability } from "@/lib/sales";

// Sales display helpers (SALES.2). Deliverability — on-time = green (live), at-risk
// = ink (brand critical), not-checked = neutral. Brand palette only (no warning hue).

export function fmtMoney(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${Math.round(n / 1e3)}k`;
  return `$${Math.round(n)}`;
}

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const DELIVERABILITY: Record<
  Deliverability,
  { dot: string; label: string }
> = {
  ON_TIME: { dot: "bg-success", label: "On-time" },
  AT_RISK: { dot: "bg-ink-strong", label: "At risk" },
  NOT_CHECKED: { dot: "bg-line-strong", label: "Not checked" },
};
