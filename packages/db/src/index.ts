/**
 * @axona/db — Prisma schema, migrations, the org-scoped client, and pagination.
 *
 * Request paths use `dbForOrg(orgId)` (ISO.1 tenant isolation enforced by an
 * extension); the bare `prisma` is for migrations/seed/system tasks only.
 */
export { prisma, dbForOrg } from "./client";
export {
  s3Configured,
  ensureBucket,
  putObject,
  getObjectBytes,
  presignedGetUrl,
  deleteObject,
  S3_BUCKET,
} from "./storage";
export type { OrgScopedDb } from "./client";

// AUDIT.1 — the immutable event-log writer (shared: apps/web routes + apps/worker).
export {
  writeAudit,
  AuditActor,
  type WriteAuditInput,
  type AuditActorInput,
} from "./audit";
export { paginateArgs, pageResult } from "./pagination";
export type { PageArgs } from "./pagination";

// Unified search (SRCH.1 + FILE.2 hybrid) — FTS ∪ vector.
export { reindex, ensureSearchIndexSchema, upsertDoc } from "./search/reindex";
export {
  search,
  moduleSearch,
  semanticSearch,
  hybridSearch,
  countByType,
} from "./search/query";
export type { SearchHit, SearchResult, SearchScope } from "./search/query";

// FILE.2 — text-extraction + embedding pipeline (Embedder DI, extraction, the
// extract-embed processor). Shared by apps/worker (BullMQ) + the in-process
// upload path + verify.
export {
  EMBED_DIM,
  FakeEmbedder,
  RealEmbedder,
  getEmbedder,
  toVectorLiteral,
  type Embedder,
} from "./embed/embedder";
export { extractText, type ExtractResult } from "./embed/extract";
export {
  FILE_EXTRACT_QUEUE,
  processFile,
  type FileExtractJob,
  type ProcessResult,
} from "./embed/process";

// MEM.1 — operational memory: ingestion (derive from the substrate) + hybrid
// recall (vector ⊕ graph proximity ⊕ recency).
export { ingestMemory, type IngestResult } from "./memory/ingest";
export {
  recallMemory,
  type RecallInput,
  type MemoryHit,
  // aliased — the bare `EntityType` name is the Prisma enum (via `export *` below).
  type EntityType as MemoryEntityType,
} from "./memory/recall";
// MEM.2 — context assembly (auto-inject operational memory into agent context).
export {
  assembleContext,
  MEMORY_TOKEN_BUDGET,
  MEMORY_CONFIDENCE_FLOOR,
  type AssembleContextInput,
  type AssembledMemory,
  type AssembledHit,
  type AssembleReason,
} from "./memory/context";

// PROSPECT.1 — the generic (marque-free) prospect-demo tenant mechanism. Only the
// TYPES live in @axona/db (so a prospect config can import them + the web build stays
// clean); the seed RUNTIME (node:fs for the logo) lives in src/scripts/lib/
// prospect-seed.ts, imported only by the seed script + verify (never bundled by web).
export type { ProspectConfig, ProspectSeedContext } from "./prospect/types";

// CONF.1 — calibrated confidence: fit a per-org raw→calibrated map from the audit
// log's outcomes, apply it, and expose the advisory autonomy-gate seam for TRUST.1.
export {
  calibrate,
  fitCalibration,
  getCalibrationModel,
  calibratedConfidence,
  meetsAutonomyThreshold,
  MIN_SAMPLES,
  DEFAULT_AUTONOMY_THRESHOLD,
} from "./confidence/calibration";
export type {
  CalibrationModelData,
  CalibrationBin,
  CalibratedConfidence,
} from "./confidence/calibration";

// TRUST.1 — the progressive-trust ladder: computeTrust (pure, deterministic) + the
// org-scoped read layer (rung computed from AUDIT.1, no stored rung). Grants no new
// autonomy — gated kinds have a hard auto ceiling; AUTO_BOUNDED is defined + disabled.
export {
  computeTrust,
  isGatedActionKind,
  ceilingFor,
  RUNG_ORDER,
  TRUST_THRESHOLDS,
  CALIBRATION_DELTA,
  AUTO_BOUNDED_ENABLED,
} from "./trust/ladder";
export type {
  TrustRung,
  TrustInput,
  TrustResult,
  TrustMetrics,
  CappedBy,
} from "./trust/ladder";
export {
  agentTrustLadder,
  computeAgentTrust,
  trustForTarget,
} from "./trust/read";
export type { TrustCell } from "./trust/read";

// PLM.1a — the Unit spine core logic: resolveConfigAt · asBuiltDiff · CSV import.
// (affectedUnits lives in @axona/agents — it reuses ONT.1 getBlastRadius.)
export {
  resolveConfigAt,
  asBuiltDiff,
  freezeConfigSnapshot,
  captureAsBuilt,
  recordFieldModification,
  applyFieldModification,
  rejectFieldModification,
  effectLabel,
  importUnits,
  importBom,
  type ResolvedConfig,
  type ResolvedHwLine,
  type AsBuiltDiffResult,
  type AsBuiltDiffLine,
  type FrozenConfigSnapshot,
  type CaptureInput,
  type CaptureResult,
  type FieldModChange,
  type RecordFieldModInput,
  type RecordFieldModResult,
  type ApplyFieldModResult,
  // SEAMS.1 — Predict substrate (read-only) + Sense input seam (types only).
  unitOutcomes,
  type UnitOutcome,
  type UnitOutcomeKind,
  type StationSignal,
  type StationEvent,
  type StationInput,
  type ImportResult,
  type RowError,
} from "./plm";

// Re-export Prisma's generated types/enums so consumers import from one place.
export * from "@prisma/client";

export const DB_PACKAGE = "@axona/db" as const;
