import type { FieldWorkOrder } from "@/lib/field-service";

// Field Service display helpers (FIELD.2). SLA labels come from the live
// countdown; a breached SLA reads in ink (critical), brand palette only.

const STATUS_LABEL: Record<string, string> = {
  DISPATCH: "Dispatch",
  EN_ROUTE: "En route",
  ON_SITE: "On-site",
  ON_JOB: "On-site",
  OPEN: "Open",
  SCHEDULED: "Scheduled",
  CLOSED: "Closed",
  AVAILABLE: "Available",
};

export function humanizeStatus(s: string): string {
  return STATUS_LABEL[s.toUpperCase()] ?? s;
}

function fmtDuration(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if (days > 0) return `${days}d ${h}h`;
  return `${h}h ${String(mm).padStart(2, "0")}m`;
}

export type SlaTone = "crit" | "warn" | "ok" | "none";

export function slaLabel(w: FieldWorkOrder): { text: string; tone: SlaTone } {
  const closed = w.status.toUpperCase() === "CLOSED";
  if (closed) return { text: "Met", tone: "ok" };
  if (w.slaMsLeft == null) return { text: "—", tone: "none" };
  if (w.slaBreached) return { text: "Breached", tone: "crit" };
  return { text: fmtDuration(w.slaMsLeft), tone: w.dueSoon ? "warn" : "ok" };
}

export const SLA_COLOR: Record<SlaTone, string> = {
  crit: "text-ink-strong",
  warn: "text-ink",
  ok: "text-ink-muted",
  none: "text-ink-muted",
};
