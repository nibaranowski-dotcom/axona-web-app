import type { InventoryKind } from "@axona/db";
import type { PartStatus } from "@/lib/inventory";

// Inventory display helpers (INV.2). Brand palette only — REORDER / QUARANTINE /
// REPLENISH render in INK (never red); functional green only for HEALTHY / STOCKED.

export const STATUS_BADGE: Record<PartStatus, { cls: string; label: string }> =
  {
    REORDER: { cls: "bg-ink-strong text-on-dark", label: "Reorder" },
    WATCH: { cls: "bg-accent text-accent-ink", label: "Watch" },
    QUARANTINE: { cls: "bg-ink-strong text-on-dark", label: "Quarantine" },
    HEALTHY: { cls: "bg-success-tint text-ink", label: "Healthy" },
  };

// Days-of-cover bar: critical/quarantine in ink, watch in ink (attention),
// healthy as a hairline fill. Cover capped at 30 days = full bar.
export function coverBar(
  status: PartStatus,
  days: number,
): {
  pct: number;
  fill: string;
  label: string;
} {
  const pct = Math.max(4, Math.min(100, Math.round((days / 30) * 100)));
  const fill = status === "HEALTHY" ? "bg-ink-faint" : "bg-ink-strong";
  const label =
    status === "QUARANTINE"
      ? "On hold"
      : days >= 30
        ? "30+ days"
        : `${days} days`;
  return { pct, fill, label };
}

// Stock-by-location bar colour by kind (matches the design legend).
export const ECHELON_COLOR: Record<InventoryKind, string> = {
  CENTRAL: "bg-ink-strong",
  LINE_SIDE: "bg-ink-strong",
  EDGE_CACHE: "bg-accent",
  FINISHED_GOODS: "bg-ink-faint",
  PLANT: "bg-ink-strong",
};

export function fmtUsd(usd: number): string {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${Math.round(usd / 1_000)}k`;
  return `$${usd}`;
}
