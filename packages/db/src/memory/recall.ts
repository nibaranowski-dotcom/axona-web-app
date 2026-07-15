import { prisma, type OrgScopedDb } from "../client";
import { getEmbedder, toVectorLiteral, type Embedder } from "../embed/embedder";

// MEM.1 — retrieval. recallMemory is a HYBRID over operational memory:
//   vector similarity  ⊕  entity-graph proximity  ⊕  recency
// combined into ONE documented, legible ranking (not a black box). Given a
// natural-language situation and/or a subject entity, it returns the most relevant
// PRIOR episodes with their outcome + provenance — real records only, never a
// synthesized memory. The graph arm is the part RAG-over-files fundamentally can't
// do: it walks the ONT.1 EntityLink neighborhood of the subject and surfaces
// memories anchored to RELATED parts/suppliers/units/ECOs, even when their text
// doesn't match the query.
//
// (The neighborhood BFS is a focused re-use of the ONT.1 EntityLink graph, kept in
// @axona/db so recall doesn't import getBlastRadius from @axona/agents — that would
// be a dependency cycle — and because recall needs the raw node IDS getBlastRadius
// doesn't expose.)

export type EntityType =
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

export interface RecallInput {
  query?: string;
  subjectType?: EntityType;
  subjectId?: string;
  kind?: string;
  limit?: number;
  maxDepth?: number; // graph-neighborhood radius (default 3)
  embedder?: Embedder;
}

export interface MemoryHit {
  summary: string;
  kind: string;
  outcome: string | null;
  subject: { type: EntityType; code: string; label: string } | null;
  occurredAt: Date;
  actorLabel: string | null;
  approverLabel: string | null;
  provenance: { sourceType: string; sourceId: string };
  score: number;
  // Why this surfaced — makes the hybrid ranking auditable (and lets a caller prove
  // graph proximity contributed a hit pure vector would miss).
  via: { vector: boolean; graph: boolean; graphDepth: number | null };
}

// ── documented hybrid weights (sum to 1) — deliberately simple + legible ────
// The question operational memory answers is "have we seen this, and HOW WAS IT
// HANDLED", so four signals combine: semantic similarity, graph proximity to the
// subject, recency, and episode KIND (a RESOLUTION/APPROVAL — how it was handled —
// is a stronger precedent than a raw decision/exception). Under the FakeEmbedder
// (offline/CI, semantically-meaningless vectors) the graph + kind + recency signals
// carry recall; under a real embedder the vector term adds true semantic recall.
const W_VECTOR = 0.2; // semantic similarity to the situation text
const W_GRAPH = 0.3; // proximity to the subject in the entity graph
const W_RECENCY = 0.15; // newer episodes edge out older ties
const W_KIND = 0.35; // a "how it was handled" episode outranks a raw event
const RECENCY_HALF_LIFE_DAYS = 90;
const MAX_NEIGHBORHOOD = 200;

// How much each episode kind reads as precedent for "how was it handled".
const KIND_SCORE: Record<string, number> = {
  RESOLUTION: 1.0,
  APPROVAL: 0.7,
  EXCEPTION: 0.5,
  GENEALOGY_EVENT: 0.5,
  TELEMETRY_ANOMALY: 0.5,
  DECISION: 0.35,
};

interface NeighborNode {
  type: EntityType;
  id: string;
  depth: number;
}

/** Bidirectional, depth-limited BFS over EntityLink from a subject — the memory
 *  neighborhood. Org-scoped through `db` (Prisma model op). Returns each reachable
 *  node with the depth it was first found at (subject = depth 0). */
async function neighborhood(
  db: OrgScopedDb,
  subjectType: EntityType,
  subjectId: string,
  maxDepth: number,
): Promise<Map<string, NeighborNode>> {
  const key = (t: string, id: string) => `${t}:${id}`;
  const seen = new Map<string, NeighborNode>();
  seen.set(key(subjectType, subjectId), {
    type: subjectType,
    id: subjectId,
    depth: 0,
  });
  let frontier: NeighborNode[] = [
    { type: subjectType, id: subjectId, depth: 0 },
  ];
  for (let d = 0; d < maxDepth && seen.size < MAX_NEIGHBORHOOD; d++) {
    if (frontier.length === 0) break;
    const next: NeighborNode[] = [];
    for (const node of frontier) {
      const edges = await db.entityLink.findMany({
        where: {
          OR: [
            { fromType: node.type, fromId: node.id },
            { toType: node.type, toId: node.id },
          ],
        },
      });
      for (const e of edges) {
        const fromIsNode = e.fromType === node.type && e.fromId === node.id;
        const nType = (fromIsNode ? e.toType : e.fromType) as EntityType;
        const nId = fromIsNode ? e.toId : e.fromId;
        const k = key(nType, nId);
        if (seen.has(k)) continue;
        const nn = { type: nType, id: nId, depth: d + 1 };
        seen.set(k, nn);
        next.push(nn);
        if (seen.size >= MAX_NEIGHBORHOOD) break;
      }
    }
    frontier = next;
  }
  return seen;
}

/** Vector arm: cosine-rank MemoryItem.embedding against the query. Raw SQL (Prisma
 *  can't touch the vector column), org-filtered explicitly. Returns id → score in
 *  [0,1]. [] gracefully when there's no query or no embeddings. */
async function vectorScores(
  orgId: string,
  query: string | undefined,
  embedder: Embedder,
  limit: number,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const term = query?.trim();
  if (!term) return out;
  const [qvec] = await embedder.embed([term]);
  if (!qvec) return out;
  const lit = toVectorLiteral(qvec);
  const rows = await prisma.$queryRaw<{ id: string; score: number }[]>`
    WITH v AS (SELECT ${lit}::vector AS qv)
    SELECT id, (1 - (embedding <=> v.qv))::float8 AS score
    FROM "MemoryItem", v
    WHERE embedding IS NOT NULL AND "orgId" = ${orgId}
    ORDER BY embedding <=> v.qv
    LIMIT ${limit};`;
  for (const r of rows) out.set(r.id, r.score);
  return out;
}

const DAY_MS = 86_400_000;
function recencyScore(occurredAt: Date, now: number): number {
  const ageDays = Math.max(0, (now - occurredAt.getTime()) / DAY_MS);
  return 0.5 ** (ageDays / RECENCY_HALF_LIFE_DAYS); // half-life decay ∈ (0,1]
}

// Resolve a subject anchor to its real record (code + label) — real records only.
async function resolveSubject(
  db: OrgScopedDb,
  type: EntityType,
  id: string,
): Promise<{ type: EntityType; code: string; label: string } | null> {
  const wrap = (code: string | undefined, label: string | undefined) =>
    code ? { type, code, label: label ?? code } : null;
  switch (type) {
    case "NCR": {
      const r = await db.nCR.findFirst({ where: { id } });
      return wrap(r?.code, r?.defect);
    }
    case "ECO": {
      const r = await db.eCO.findFirst({ where: { id } });
      return wrap(r?.code, r?.title);
    }
    case "PART":
    case "LOT": {
      const r = await db.part.findFirst({ where: { id } });
      return wrap(r?.sku, r?.name);
    }
    case "SUPPLIER": {
      const r = await db.supplier.findFirst({ where: { id } });
      return wrap(r?.name, r?.name);
    }
    case "PURCHASE_ORDER": {
      const r = await db.purchaseOrder.findFirst({ where: { id } });
      return wrap(r?.code, r?.status);
    }
    case "UNIT": {
      const r = await db.workOrderMfg.findFirst({ where: { id } });
      return wrap(r?.serial, r?.product);
    }
    case "DELIVERY": {
      const r = await db.delivery.findFirst({ where: { id } });
      return wrap(r?.code, r?.account);
    }
    case "WORK_ORDER": {
      const r = await db.workOrderField.findFirst({ where: { id } });
      return wrap(r?.code, r?.issue);
    }
    case "SPC_SAMPLE": {
      const r = await db.spcSample.findFirst({ where: { id } });
      return wrap(r?.characteristic, r?.serial);
    }
    case "INVOICE": {
      const r = await db.invoice.findFirst({ where: { id } });
      return wrap(r?.code, r?.account);
    }
  }
}

export async function recallMemory(
  db: OrgScopedDb,
  input: RecallInput,
): Promise<MemoryHit[]> {
  const orgId = db.$org;
  const limit = Math.min(Math.max(input.limit ?? 5, 1), 25);
  const maxDepth = Math.min(Math.max(input.maxDepth ?? 3, 1), 5);
  const embedder = input.embedder ?? getEmbedder();

  // 1. graph neighborhood of the subject (if any) → the node set to pull memories for.
  const neigh =
    input.subjectType && input.subjectId
      ? await neighborhood(db, input.subjectType, input.subjectId, maxDepth)
      : new Map<string, NeighborNode>();

  // 2. gather candidate memories: vector top-N ∪ graph-anchored ∪ (subject itself).
  const vScores = await vectorScores(
    orgId,
    input.query,
    embedder,
    Math.max(limit * 4, 20),
  );

  // graph-anchored candidates: memories whose subject is any neighborhood node.
  const nodeList = [...neigh.values()];
  const graphAnchored = nodeList.length
    ? await db.memoryItem.findMany({
        where: {
          OR: nodeList.map((n) => ({
            subjectType: n.type as never,
            subjectId: n.id,
          })),
          ...(input.kind ? { kind: input.kind as never } : {}),
        },
      })
    : [];

  // vector candidates: fetch the rows the vector arm ranked.
  const vectorIds = [...vScores.keys()];
  const vectorRows = vectorIds.length
    ? await db.memoryItem.findMany({
        where: {
          id: { in: vectorIds },
          ...(input.kind ? { kind: input.kind as never } : {}),
        },
      })
    : [];

  // 3. merge (dedupe by id), score with the documented hybrid weights.
  const byId = new Map<
    string,
    (typeof graphAnchored)[number] & { embedding?: unknown }
  >();
  for (const r of graphAnchored) byId.set(r.id, r);
  for (const r of vectorRows) if (!byId.has(r.id)) byId.set(r.id, r);

  const now = Date.now();
  const depthOf = (type: string | null, id: string | null): number | null => {
    if (!type || !id) return null;
    const n = neigh.get(`${type}:${id}`);
    return n ? n.depth : null;
  };

  const scored = [...byId.values()].map((m) => {
    const vScore = vScores.get(m.id) ?? 0;
    const gDepth = depthOf(m.subjectType, m.subjectId);
    const gScore = gDepth === null ? 0 : 1 / (1 + gDepth); // subject=1, closer neighbors weigh more
    const rScore = recencyScore(m.occurredAt, now);
    const kScore = KIND_SCORE[m.kind] ?? 0.4;
    const score =
      W_VECTOR * vScore +
      W_GRAPH * gScore +
      W_RECENCY * rScore +
      W_KIND * kScore;
    return {
      m,
      score,
      via: {
        vector: vScore > 0,
        graph: gDepth !== null,
        graphDepth: gDepth,
      },
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit);

  // 4. resolve subjects (real records only) + shape.
  const hits: MemoryHit[] = [];
  for (const s of top) {
    const subject =
      s.m.subjectType && s.m.subjectId
        ? await resolveSubject(db, s.m.subjectType as EntityType, s.m.subjectId)
        : null;
    hits.push({
      summary: s.m.summary,
      kind: s.m.kind,
      outcome: s.m.outcome,
      subject,
      occurredAt: s.m.occurredAt,
      actorLabel: s.m.actorLabel,
      approverLabel: s.m.approverLabel,
      provenance: { sourceType: s.m.sourceType, sourceId: s.m.sourceId },
      score: Math.round(s.score * 1000) / 1000,
      via: s.via,
    });
  }
  return hits;
}
