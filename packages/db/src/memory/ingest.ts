import { prisma, type OrgScopedDb } from "../client";
import { getEmbedder, toVectorLiteral, type Embedder } from "../embed/embedder";

// MEM.1 — ingestion. DERIVE MemoryItems from the EXISTING substrate (no new
// capture): AuditLog → DECISION/APPROVAL, NCR → EXCEPTION (+RESOLUTION when
// terminal), SpcSample breach → EXCEPTION, SafetyIncident → EXCEPTION. Idempotent
// (the @@unique([orgId, sourceType, sourceId]) makes re-runs no-ops via
// createMany skipDuplicates) and incremental (a `since` bound on the timestamped
// sources). Embeds each summary with the DI embedder (Fake offline/CI, Real behind
// EMBED_API_KEY) and writes the pgvector column via raw SQL — only for rows that
// don't have one yet, so re-ingest never re-embeds.
//
// GUARDRAIL: ingestion READS the substrate and WRITES ONLY MemoryItem. It never
// mutates AuditLog / NCR / SpcSample / SafetyIncident — memory is derived, the
// sources stay canonical.

type MemoryKind =
  | "DECISION"
  | "EXCEPTION"
  | "APPROVAL"
  | "RESOLUTION"
  | "GENEALOGY_EVENT"
  | "TELEMETRY_ANOMALY";

type EntityType =
  | "NCR"
  | "ECO"
  | "PART"
  | "SUPPLIER"
  | "PURCHASE_ORDER"
  | "UNIT"
  | "LOT"
  | "DELIVERY"
  | "WORK_ORDER"
  | "SPC_SAMPLE"
  | "INVOICE";

interface MemRow {
  kind: MemoryKind;
  summary: string;
  subjectType: EntityType | null;
  subjectId: string | null;
  sourceType: string;
  sourceId: string;
  outcome: string | null;
  actorLabel: string | null;
  approverLabel: string | null;
  model: string | null;
  confidence: number | null;
  occurredAt: Date;
}

// AuditLog.targetType (a Prisma model name) → the ONT.1 EntityType it anchors to.
// Non-ontology targets (File, MatrixColumn, WorkflowRun, Org, …) anchor to null —
// the episode is still recallable by vector + recency, just not by graph proximity.
// Exported so LOOP.1's writeback anchors an outcome episode to the SAME ontology
// entity MEM.1 ingest would (one convention → recall surfaces both).
export const TARGET_TO_ENTITY: Record<string, EntityType> = {
  NCR: "NCR",
  ECO: "ECO",
  PurchaseOrder: "PURCHASE_ORDER",
  Part: "PART",
  Supplier: "SUPPLIER",
  Delivery: "DELIVERY",
  WorkOrderMfg: "UNIT",
  WorkOrderField: "WORK_ORDER",
  Invoice: "INVOICE",
};

/** Terminal NCR states that also yield a RESOLUTION episode ("we contained this"). */
const NCR_TERMINAL = new Set(["CONTAINED", "CLOSED", "RESOLVED"]);

export interface IngestResult {
  created: number; // new MemoryItems inserted this run (0 on a clean re-run)
  embedded: number; // rows embedded this run (only previously-un-embedded ones)
  candidates: number; // total derived episodes considered
}

export async function ingestMemory(
  db: OrgScopedDb,
  opts: { since?: Date; embedder?: Embedder } = {},
): Promise<IngestResult> {
  const orgId = db.$org;
  const { since } = opts;
  const rows: MemRow[] = [];

  // ── AuditLog → DECISION / APPROVAL ────────────────────────────────────────
  // An entry is an APPROVAL when it carries an approver (the AUDIT.3 approval
  // marker); otherwise it's a DECISION (an agent/human/system action on the record).
  const audits = await db.auditLog.findMany({
    where: since ? { createdAt: { gte: since } } : {},
    orderBy: { createdAt: "asc" },
  });
  for (const a of audits) {
    const outcome =
      a.output && typeof a.output === "object" && "status" in a.output
        ? String((a.output as { status: unknown }).status)
        : null;
    rows.push({
      kind: a.approverLabel ? "APPROVAL" : "DECISION",
      summary: a.summary,
      subjectType: TARGET_TO_ENTITY[a.targetType] ?? null,
      subjectId: TARGET_TO_ENTITY[a.targetType] ? a.targetId : null,
      sourceType: "AuditLog",
      sourceId: a.id,
      outcome,
      actorLabel: a.actorLabel,
      approverLabel: a.approverLabel,
      model: a.model,
      confidence: a.confidence,
      occurredAt: a.createdAt,
    });
  }

  // ── NCR → EXCEPTION (+ RESOLUTION when terminal) ──────────────────────────
  // NCR has no timestamp column; derive occurredAt from its own AuditLog trail
  // (open = earliest, resolution = latest decision) and carry the approver.
  // VERIFY.3 — ordered so memory rows are ingested in a stable sequence; recall
  // tie-breaks (equal scores) would otherwise depend on Postgres heap order.
  const ncrs = await db.nCR.findMany({ orderBy: { code: "asc" } });
  for (const n of ncrs) {
    const trail = audits.filter(
      (a) => a.targetType === "NCR" && a.targetId === n.id,
    );
    const firstAt = trail[0]?.createdAt ?? new Date();
    const lastDecision =
      [...trail].reverse().find((a) => a.approverLabel) ??
      trail[trail.length - 1];
    rows.push({
      kind: "EXCEPTION",
      summary: `${n.code}: ${n.defect} (${n.severity.toLowerCase()}) — linked to ${n.linkedTo}`,
      subjectType: "NCR",
      subjectId: n.id,
      sourceType: "NCR",
      sourceId: n.id,
      outcome: n.status,
      actorLabel: trail[0]?.actorLabel ?? null,
      approverLabel: null,
      model: null,
      confidence: null,
      occurredAt: firstAt,
    });
    if (NCR_TERMINAL.has(n.status.toUpperCase())) {
      rows.push({
        kind: "RESOLUTION",
        summary: `${n.code} ${n.status.toLowerCase()}: ${n.defect} — resolved; see the containment/ECO trail`,
        subjectType: "NCR",
        subjectId: n.id,
        sourceType: "NCR",
        // distinct from the EXCEPTION's sourceId so both coexist under @@unique
        sourceId: `${n.id}#resolution`,
        outcome: n.status,
        actorLabel: lastDecision?.actorLabel ?? null,
        approverLabel: lastDecision?.approverLabel ?? null,
        model: null,
        confidence: null,
        occurredAt: lastDecision?.createdAt ?? firstAt,
      });
    }
  }

  // ── SpcSample breach → EXCEPTION ──────────────────────────────────────────
  // Same breach predicate as runSpcCheck (value outside [LCL, UCL]) — kept a
  // one-liner here to avoid a @axona/db → @axona/agents cycle.
  const samples = await db.spcSample.findMany({
    where: since ? { ts: { gte: since } } : {},
  });
  for (const s of samples) {
    if (!(s.value > s.ucl || s.value < s.lcl)) continue;
    rows.push({
      kind: "EXCEPTION",
      summary: `SPC breach on ${s.characteristic} (${s.serial}): ${s.value} outside control limits [${s.lcl}, ${s.ucl}]`,
      subjectType: "SPC_SAMPLE",
      subjectId: s.id,
      sourceType: "SpcSample",
      sourceId: s.id,
      outcome: "out of spec",
      actorLabel: null,
      approverLabel: null,
      model: null,
      confidence: null,
      occurredAt: s.ts,
    });
  }

  // ── SafetyIncident → EXCEPTION ────────────────────────────────────────────
  // No ontology anchor (robotSerial is a Robot, not an EntityType) → subject null;
  // recallable by vector + recency. No timestamp column → occurredAt = createdAt-less
  // fallback via the audit trail is unavailable, so anchor to the ingest moment.
  const incidents = await db.safetyIncident.findMany({});
  for (const inc of incidents) {
    rows.push({
      kind: "EXCEPTION",
      summary: `${inc.code} safety ${inc.type} on ${inc.robotSerial} @ ${inc.site} (${inc.severity.toLowerCase()})`,
      subjectType: null,
      subjectId: null,
      sourceType: "SafetyIncident",
      sourceId: inc.id,
      outcome: inc.status,
      actorLabel: null,
      approverLabel: null,
      model: null,
      confidence: null,
      occurredAt: new Date(),
    });
  }

  // ── idempotent insert (skipDuplicates honours @@unique) ───────────────────
  const insert = await db.memoryItem.createMany({
    data: rows.map((r) => ({
      // org-scoped client re-injects orgId at runtime; set it here so the
      // createMany input type is satisfied (same value either way).
      orgId,
      kind: r.kind,
      summary: r.summary,
      subjectType: r.subjectType,
      subjectId: r.subjectId,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      outcome: r.outcome,
      actorLabel: r.actorLabel,
      approverLabel: r.approverLabel,
      model: r.model,
      confidence: r.confidence,
      occurredAt: r.occurredAt,
    })),
    skipDuplicates: true,
  });

  // ── embed the un-embedded (idempotent: only rows with a NULL vector) ──────
  const embedded = await embedPending(orgId, opts.embedder);

  return { created: insert.count, embedded, candidates: rows.length };
}

/** Embed every MemoryItem for this org that has no vector yet. Raw SQL both ways
 *  (Prisma can't read/write the `Unsupported("vector")` column). Org-filtered so a
 *  tenant's memory never leaks. Exported so LOOP.1's writeback reuses the SAME embed
 *  path (no parallel embedding) — an OUTCOME episode is immediately recall-able. */
export async function embedPending(
  orgId: string,
  embedderOpt?: Embedder,
): Promise<number> {
  const pending = await prisma.$queryRaw<{ id: string; summary: string }[]>`
    SELECT id, summary FROM "MemoryItem"
    WHERE "orgId" = ${orgId} AND embedding IS NULL`;
  if (pending.length === 0) return 0;
  const embedder = embedderOpt ?? getEmbedder();
  const vectors = await embedder.embed(pending.map((p) => p.summary));
  let n = 0;
  for (let i = 0; i < pending.length; i++) {
    const v = vectors[i];
    if (!v) continue;
    const lit = toVectorLiteral(v);
    await prisma.$executeRaw`
      UPDATE "MemoryItem" SET embedding = ${lit}::vector
      WHERE id = ${pending[i]!.id} AND "orgId" = ${orgId}`;
    n++;
  }
  return n;
}
