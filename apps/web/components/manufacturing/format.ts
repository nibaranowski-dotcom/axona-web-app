import type { LineStation } from "@/lib/manufacturing";

// Manufacturing display helpers (MFG.2). Node/badge tones — active = lime, held =
// ink, done = ink-fill, pending = hairline. Brand palette only.

const STATION_LABEL: Record<string, string> = {
  "Frame Build": "Frame",
  "Drive Integration": "Drive",
  Actuators: "Actuators",
  Firmware: "Firmware",
  Test: "Test",
  "Pack-out": "Pack",
};
export function stationLabel(station: string): string {
  return STATION_LABEL[station] ?? station;
}

const HELD = new Set(["HOLD", "HALT", "HALTED", "BLOCKED"]);
const WIP = new Set(["WIP", "IN_PROGRESS", "RUNNING", "STARTED"]);

export type NodeState = "done" | "current" | "blocked" | "pending";

/** A station node's state from the work orders sitting at it. */
export function nodeState(station?: LineStation): NodeState {
  if (!station || station.count === 0) return "pending";
  if (station.workOrders.some((w) => HELD.has(w.status.toUpperCase())))
    return "blocked";
  if (station.workOrders.some((w) => WIP.has(w.status.toUpperCase())))
    return "current";
  return "done";
}

// Genealogy / work-order status → pill classes (AA-safe).
export function statusBadge(status: string): string {
  const s = status.toUpperCase();
  if (HELD.has(s)) return "bg-ink-strong text-on-dark";
  if (WIP.has(s)) return "bg-accent text-accent-ink";
  if (s === "DONE" || s === "COMPLETE" || s === "COMPLETED")
    return "bg-success-tint text-ink";
  return "bg-panel text-ink-muted";
}

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
