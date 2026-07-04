import type { RunStatus, WorkflowStatus } from "@axona/db";
import type { TraceLine } from "@axona/agents";
import type { LastRun, StepKind } from "@/lib/workflows";
import type { TraceLine as ConsoleLine } from "@/components/shell/TraceConsole";

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

// --- WFL.2 detail ---

// Step-flow marker per node kind. Trigger = lime, agent = neutral glyph, decision
// = hairline, guardrail/approval = ink (the parked gate — never red), output =
// green (a reached terminal). Colours are token classes.
export const STEP_MARKER: Record<
  StepKind,
  { ring: string; icon: string; label: string }
> = {
  trigger: { ring: "bg-accent text-accent-ink", icon: "zap", label: "Trigger" },
  agent: { ring: "bg-panel-2 text-ink", icon: "glyph", label: "Agent" },
  decision: {
    ring: "bg-paper border border-line-strong text-ink",
    icon: "fork",
    label: "Decision",
  },
  guardrail: {
    ring: "bg-ink-strong text-on-dark",
    icon: "shield",
    label: "Approval",
  },
  output: {
    ring: "bg-success-tint text-success",
    icon: "check",
    label: "Output",
  },
};

/** Run duration → "35s" / "2m 05s" (drives the "Avg run" stat). */
export function fmtDuration(ms: number | null): string {
  if (ms == null || ms <= 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${String(rem).padStart(2, "0")}s`;
}

const timeOf = (iso?: string): string => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(11, 19);
};

/** Map a persisted WorkflowRun.trace to TraceConsole lines (kind · text). */
export function toConsoleLines(trace: TraceLine[]): ConsoleLine[] {
  return trace.map((l) => ({
    ts: timeOf(l.ts),
    text: `${l.kind.padEnd(12)} · ${l.text}`,
  }));
}

// Recent-run dot: succeeded = green, parked/awaiting = ink, failed = ink,
// running = lime. Never red.
export const RUN_DOT: Record<RunStatus, string> = {
  SUCCEEDED: "bg-success",
  AWAITING_APPROVAL: "bg-ink-strong",
  FAILED: "bg-ink-strong",
  RUNNING: "bg-accent",
};

export function runOutcome(status: RunStatus): string {
  switch (status) {
    case "SUCCEEDED":
      return "Completed";
    case "AWAITING_APPROVAL":
      return "Awaiting approval";
    case "FAILED":
      return "Failed";
    case "RUNNING":
      return "Running";
  }
}
