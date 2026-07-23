// PLM.5 — the client-safe half of the blast-radius module: types + labels only.
//
// `lib/blast-radius.ts` imports @axona/agents (which reaches node:fs), so a
// client component must never import it — even for a constant. Everything the
// view needs at runtime lives here, with no server imports, and the server
// module re-exports it so there is still ONE definition of each type/label.

export type TraceType = "lot" | "sw" | "eco" | "part";

export const TRACE_LABEL: Record<TraceType, string> = {
  lot: "Lot",
  sw: "SW version",
  eco: "ECO",
  part: "Part revision",
};

export interface BlastRow {
  code: string;
  label: string;
  status: string;
  /** The relation path from the trace root to this record. */
  path: string;
  href: string;
  /** True for rows that are Units — verify asserts these link to /units/:serial. */
  isUnit: boolean;
}

export interface BlastGroup {
  module: string;
  count: number;
  summary: string;
  rows: BlastRow[];
}

export interface TraceOption {
  value: string;
  label: string;
  hint?: string;
}

export interface BlastRadiusView {
  type: TraceType;
  value: string | null;
  found: boolean;
  rootLabel: string;
  rootHint: string | null;
  groups: BlastGroup[];
  summary: { units: number; sites: number; customers: number };
  /** Selectable roots per type, from real records only. */
  options: Record<TraceType, TraceOption[]>;
  /** Deployed affected units — what a field-service hand-off would act on. */
  handoffSerials: string[];
  message?: string;
}
