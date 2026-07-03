import type { MarketingCampaign } from "@/lib/marketing";

// Marketing display helpers (MKT.2). Underperforming = ink (brand critical),
// dominant channel = lime, live = functional green. Brand palette only.

export function fmtMoney(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${Math.round(n / 1e3)}k`;
  return `$${Math.round(n)}`;
}

export function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}

const CHANNEL_LABEL: Record<string, string> = {
  events: "Events",
  paid: "Paid",
  abm: "ABM outbound",
  content: "Content / SEO",
  email: "Email / nurture",
};
export function channelLabel(ch: string): string {
  return CHANNEL_LABEL[ch.toLowerCase()] ?? ch;
}

// Campaign status → pill classes + label (AA-safe).
export function campaignStatus(c: MarketingCampaign): {
  cls: string;
  label: string;
} {
  if (c.underperforming)
    return { cls: "bg-ink-strong text-on-dark", label: "Underperforming" };
  if (c.status.toUpperCase() === "PAUSED")
    return { cls: "bg-panel text-ink-muted", label: "Paused" };
  return { cls: "bg-success-tint text-ink", label: "Live" };
}
