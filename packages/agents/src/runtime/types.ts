import type { z } from "zod";
import type { OrgScopedDb } from "@axona/db";
import type { TraceCollector } from "./trace";

// ART.1 — the typed contracts every agent surface (ART.4 chat, GA.1 copilot,
// WF.1 workflows) builds on. Tools are tenant-scoped via ctx.db = dbForOrg(orgId);
// money/safety/contract tools are `gated` (propose, never auto-execute).

export type TraceKind =
  | "scan"
  | "correlate"
  | "draft"
  | "policy-check"
  | "tool"
  | "tool-result"
  | "result"
  | "error"
  | "proposal";

/** One timestamped trace line (feeds the ART.5 console + AUDIT.3). */
export interface TraceLine {
  ts: string;
  kind: TraceKind;
  text: string;
  data?: unknown;
  /** Uncalibrated for now — calibration is CONF.1. */
  confidence?: number;
}

/** Per-run, per-tenant execution context handed to every tool handler. */
export interface AgentContext {
  orgId: string;
  userId: string;
  agentId: string;
  /** = dbForOrg(orgId) — every tool reads/writes tenant-scoped (ISO.1). */
  db: OrgScopedDb;
  trace: TraceCollector;
}

/** A tool the runtime can call. The ART.2 plug point. */
export interface Tool<I = unknown, O = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<I>;
  /** money/safety/contract → the runtime proposes, never auto-executes. */
  gated?: boolean;
  handler: (input: I, ctx: AgentContext) => Promise<O>;
}

export interface AgentDef {
  systemPrompt: string;
  tools: Tool[];
  scope: string;
}

export type RunStatusResult = "SUCCEEDED" | "FAILED" | "AWAITING_APPROVAL";

export interface RunResult {
  runId: string;
  text: string;
  trace: TraceLine[];
  status: RunStatusResult;
}
