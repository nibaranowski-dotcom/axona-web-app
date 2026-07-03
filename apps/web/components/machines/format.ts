import type { HealthLevel, MachineStatus } from "@axona/db";

// Machines display helpers (MACH.1). Running = green (live), maintenance/charging
// = lime, fault/critical = ink (never red), idle = neutral. Brand palette only.

export const STATUS_BADGE: Record<
  MachineStatus,
  { cls: string; dot: string; label: string }
> = {
  RUNNING: {
    cls: "bg-success-tint text-ink",
    dot: "bg-success",
    label: "Running",
  },
  IDLE: {
    cls: "bg-panel text-ink-muted",
    dot: "bg-line-strong",
    label: "Idle",
  },
  MAINTENANCE: {
    cls: "bg-accent text-accent-ink",
    dot: "bg-accent-ink",
    label: "Maintenance",
  },
  CHARGING: {
    cls: "bg-accent text-accent-ink",
    dot: "bg-accent-ink",
    label: "Charging",
  },
  FAULT: {
    cls: "bg-ink-strong text-on-dark",
    dot: "bg-on-dark",
    label: "Fault",
  },
};

export const HEALTH_DOT: Record<HealthLevel, string> = {
  OK: "bg-success",
  WATCH: "bg-accent",
  BAD: "bg-ink-strong",
};

// Utilization bar — high runs ink, normal is a hairline fill.
export const utilColor = (util: number) =>
  util >= 80 ? "bg-ink-strong" : "bg-ink-faint";
