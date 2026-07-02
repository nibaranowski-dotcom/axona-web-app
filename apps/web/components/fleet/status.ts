// Shared robot-status vocabulary for the Fleet screen (FLEET.2). Maps the seeded
// status strings to the v2 health buckets + brand colors (brand palette only):
// critical is ink; attention is lime; nominal is functional green; offline is a
// hairline.

export interface StatusMeta {
  label: string; // status pill label
  bucket: string; // health-distribution bucket
  dot: string; // Tailwind bg for a status dot
  bar: string; // Tailwind bg for the uptime bar
  spark: string; // CSS var for the telemetry sparkline stroke
  badge: string; // Tailwind classes for the status pill
}

export const STATUS: Record<string, StatusMeta> = {
  ACTIVE: {
    label: "Nominal",
    bucket: "Nominal",
    dot: "bg-success",
    bar: "bg-success",
    spark: "var(--ink-faint)",
    badge: "bg-success-tint text-ink",
  },
  WATCH: {
    label: "Watch",
    bucket: "Attention",
    dot: "bg-accent",
    bar: "bg-accent",
    spark: "var(--accent)",
    badge: "bg-accent text-accent-ink",
  },
  FAULT: {
    label: "Fault",
    bucket: "Critical",
    dot: "bg-ink-strong",
    bar: "bg-ink-strong",
    spark: "var(--ink-strong)",
    badge: "bg-ink-strong text-on-dark",
  },
  OFFLINE: {
    label: "Offline",
    bucket: "Offline",
    dot: "bg-line-strong",
    bar: "bg-line-strong",
    spark: "var(--line-strong)",
    badge: "bg-panel text-ink-muted",
  },
};

export function metaFor(status: string): StatusMeta {
  return STATUS[status.toUpperCase()] ?? STATUS.OFFLINE!;
}

// Health-distribution buckets, in order, with the status each maps from.
export const HEALTH_BUCKETS: {
  bucket: string;
  status: string;
  bar: string;
  dot: string;
}[] = [
  { bucket: "Nominal", status: "ACTIVE", bar: "bg-success", dot: "bg-success" },
  { bucket: "Attention", status: "WATCH", bar: "bg-accent", dot: "bg-accent" },
  {
    bucket: "Critical",
    status: "FAULT",
    bar: "bg-ink-strong",
    dot: "bg-ink-strong",
  },
  {
    bucket: "Offline",
    status: "OFFLINE",
    bar: "bg-line-strong",
    dot: "bg-line-strong",
  },
];
