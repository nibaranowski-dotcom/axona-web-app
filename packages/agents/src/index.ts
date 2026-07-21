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
  ToolCategory,
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
export { runAgent } from "./runtime/run-agent";

// General Axona agent (GA.1) — cross-module read-only copilot.
export {
  AXONA_AGENT_CODE,
  AXONA_AGENT_ROLE,
  axonaSystemPrompt,
  getAxonaAgent,
} from "./agents/axona";

// Typed tool registry (ART.2) — registry, agent assembly, test helper, and the
// per-module tool sets.
export {
  registry,
  buildAgentDef,
  testDef,
  // core
  coreTools,
  searchOperations,
  getModuleSummary,
  // procurement (the wedge)
  procurementTools,
  getPartStatus,
  listReorderCandidates,
  getSupplierRisk,
  draftPurchaseOrder,
  sendPurchaseOrder,
  // quality
  qualityTools,
  runSpcCheck,
  listOpenNcrs,
  getCertStatus,
  openNcr,
  // engineering
  engineeringTools,
  getEco,
  getCompatMatrix,
  draftEco,
  releaseEco,
  // field service
  fieldServiceTools,
  getWorkOrder,
  findCertifiedTech,
  getSlaCountdown,
  routeTechnician,
  // finance
  financeTools,
  getUnitEconomics,
  getArAging,
  recognizeRevenue,
  issueCreditNote,
  // inventory
  inventoryTools,
  getStock,
  // ontology (ONT.1) — the entity-link graph + blast-radius traversal
  getBlastRadius,
  getBlastRadiusTool,
  // PLM.1a — affected-units façade over the Unit spine + ONT.1 blast radius
  affectedUnits,
  // memory (MEM.1) — recall prior operational episodes
  recallMemoryTool,
} from "./tools";
export type { EntityType, BlastRadiusResult, BlastNode } from "./tools";
export type { AffectedUnit, AffectedUnitsResult } from "./tools";

// WF.1 — the workflow DAG schema + run engine (BullMQ consumer in apps/worker;
// in-process path for the enqueue API + verify when there is no Redis).
export {
  WorkflowGraph,
  TriggerNode,
  AgentNode,
  GateNode,
  OutputNode,
  WorkflowNode,
  parseGraph,
  safeParseGraph,
  evalCondition,
  type GateCondition,
  type GateOp,
} from "./workflow/graph";
export {
  WORKFLOW_QUEUE,
  createWorkflowRun,
  runWorkflow,
  executeWorkflowRun,
  resumeParkedRun,
  type WorkflowRunJob,
  type RunOutcome,
} from "./workflow/executor";

// MTX.1 — ask-across-files column extraction (structured ColumnAnswer over
// File.text + the fan-out job; BullMQ consumer in apps/worker + in-process path).
export {
  ColumnAnswer,
  extractColumn,
  getExtractionModel,
  FakeExtractionModel,
  LOW_CONF_FALLBACK,
  EMPTY_TEXT_ANSWER,
} from "./matrix/extract";
export {
  MATRIX_EXTRACT_QUEUE,
  runColumnExtraction,
  removeColumnAnswers,
  type MatrixExtractJob,
  type MatrixExtractResult,
} from "./matrix/job";

export const AGENTS_PACKAGE = "@axona/agents" as const;
