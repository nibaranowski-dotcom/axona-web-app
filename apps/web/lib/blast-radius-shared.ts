// PLM.5 — the client-safe half of the blast-radius module: types + labels only.
//
// `lib/blast-radius.ts` imports @axona/agents (which reaches node:fs), so a
// client component must never import it — even for a constant. Everything the
// view needs at runtime lives here, with no server imports, and the server
// module re-exports it so there is still ONE definition of each type/label.

// DEMO.6 #5 — TYPE-ONLY import. `agent-proposal` imports @axona/db at runtime, which
// is exactly what this module exists to keep out of the client bundle; `import type`
// is erased at compile time, so no runtime edge is created. Anything more than a type
// from that module would have to be re-declared here instead.
import type { AgentProposal } from "./agent-proposal";

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
  /**
   * DEMO.6 #5 — the agent that COMPUTED this set, with a confidence derived from how
   * much the traversal actually corroborated. Null when nothing traces: a blank set
   * is a real answer, and a proposal about it would be noise.
   */
  agent: AgentProposal | null;
  message?: string;
}
