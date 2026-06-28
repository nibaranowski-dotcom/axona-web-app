/**
 * @axona/agents — the multi-agent intelligence layer (the moat).
 *
 * ART.1 (this story): AgentRuntime — a Claude tool-use loop behind a `ModelClient`
 * interface (real Anthropic impl + a FakeModelClient for offline tests). Tools are
 * Zod-validated and tenant-scoped via ctx.db = dbForOrg(orgId); money/safety/
 * contract tools propose, never auto-execute; every run is persisted as an
 * AgentRun with its trace + the model used.
 *
 * Still ahead in epic E3:
 *   ART.2  Typed tool registry over the data model (Zod I/O)
 *   ART.3  Module orchestrator — cross-module routing -> agent trace
 *   WF.1   Workflow DAG model + BullMQ run engine
 */

// Contracts
export type {
  AgentContext,
  AgentDef,
  RunResult,
  RunStatusResult,
  Tool,
  TraceKind,
  TraceLine,
} from "./runtime/types";

// Model client (DI)
export { AnthropicModelClient, FakeModelClient } from "./runtime/model-client";
export type {
  ModelClient,
  ModelMessage,
  ModelResponse,
  ModelToolSpec,
} from "./runtime/model-client";

// Runtime
export { TraceCollector } from "./runtime/trace";
export { runLoop, canUseTool } from "./runtime/runtime";
export { runAgent, buildAgentDef } from "./runtime/run-agent";

// Example tools (full registry is ART.2) + test helper
export {
  ALL_TOOLS,
  toolsForModule,
  testDef,
  searchOperations,
  getPartStatus,
  listOpenNcrs,
  draftPurchaseOrder,
} from "./tools";

export const AGENTS_PACKAGE = "@axona/agents" as const;
