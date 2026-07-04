import type { RunStatus, WorkflowStatus } from "@axona/db";
import type { LastRun } from "@/lib/workflows";

// Workflows display helpers (WFL.1). Active = green (live), draft = neutral,
// paused = lime. Brand palette only; a parked/critical run renders in ink (never
// red).

export const STATUS_BADGE: Record<
  WorkflowStatus,
  { cls: string; dot: string; label: string }
> = {
  ACTIVE: {
    cls: "bg-success-tint text-ink",
    dot: "bg-success",
    label: "Active",
  },
  DRAFT: {
    cls: "bg-panel text-ink-muted",
    dot: "bg-line-strong",
    label: "Draft",
  },
  PAUSED: {
    cls: "bg-accent text-accent-ink",
    dot: "bg-accent-ink",
    label: "Paused",
  },
};

function ago(at: Date, now: number): string {
  const s = Math.max(0, Math.floor((now - new Date(at).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// The last-run cell. A SUCCEEDED run shows only its relative time (per the
// design); a parked (AWAITING_APPROVAL) or FAILED run surfaces its status too, in
// ink — so the real persisted run state is visible, never hidden as a timestamp.
export function lastRunLabel(
  lastRun: LastRun | null,
  now: number,
): { text: string; emphasis: boolean } {
  if (!lastRun) return { text: "—", emphasis: false };
  const t = ago(lastRun.at, now);
  const word: Partial<Record<RunStatus, string>> = {
    AWAITING_APPROVAL: "Awaiting approval",
    FAILED: "Failed",
    RUNNING: "Running",
  };
  const w = word[lastRun.status];
  return w
    ? { text: `${w} · ${t}`, emphasis: true }
    : { text: t, emphasis: false };
}
