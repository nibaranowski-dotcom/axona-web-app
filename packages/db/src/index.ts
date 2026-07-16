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
} from "./memory/recall";

// PROSPECT.1 — the generic (marque-free) prospect-demo tenant mechanism. Only the
// TYPES live in @axona/db (so a prospect config can import them + the web build stays
// clean); the seed RUNTIME (node:fs for the logo) lives in src/scripts/lib/
// prospect-seed.ts, imported only by the seed script + verify (never bundled by web).
export type { ProspectConfig, ProspectSeedContext } from "./prospect/types";

// Re-export Prisma's generated types/enums so consumers import from one place.
export * from "@prisma/client";

export const DB_PACKAGE = "@axona/db" as const;
