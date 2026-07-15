# PRD — MEM.1 · Operational memory (structured graph + vector over the operational record)

**Story:** MEM.1 — A structured memory store (graph + vector) over decisions, exceptions, approvals,
genealogy, and telemetry, plus a `recallMemory` retrieval tool wired to the Axona agent — so proposals are
informed by what happened last time. **NOT RAG-over-PDFs.**
**Spec ref:** `specs/architecture-learnings.md` **L2 Intelligence spine → operational memory** (the layer that
compounds — the moat); backlog E12 row 119. **Pri/size:** P0 · L. **Track:** Moat (E12). **Depth:** Full CPRD —
**the single most moat-load-bearing story in the backlog.**
**Deps:** ONT.1 (EntityLink graph + `getBlastRadius`), AUDIT.1/AUDIT.3 (immutable event log w/ model·
confidence·approver·correlationId), the Embedder DI + raw-SQL HNSW pattern (FILE.2/SRCH.1), the agent runtime
(ART.1/ART.2) + the Axona cross-module agent (GA.1). **Downstream:** MEM.2 (auto context-assembly into prompts),
CONF.1 (calibrated confidence reads memory), LOOP.1 (the learning loop closes through here).

## What this is, precisely (and what it is NOT)

Operational memory is the **"memory" node of the loop**: `data → memory → models → better proposals →
outcomes → data`. It is a **structured, typed, entity-linked, embedded record of operational episodes** —
decisions made, exceptions raised, approvals granted, resolutions applied — that an agent can **recall by
similarity AND by graph proximity** when it drafts a new proposal.

It is **not**:
- **RAG-over-PDFs / file search.** That's `SearchDoc` (SRCH.1) + `File.embedding` (FILE.2), and the schema
  explicitly disclaims both as "not the operational-memory moat." Do not overload them. MEM.1 gets its **own**
  table.
- **The audit log.** AuditLog is the immutable *event* record (append-only facts). Memory is a *derived,
  retrievable, semantically-indexed* layer built **from** the audit log + exceptions + genealogy — optimized
  for recall, not for compliance. Memory reads AuditLog; it never forks or mutates it.
- **The entity graph alone.** EntityLink answers "what is connected." Memory answers "what happened, and how
  did it turn out." Memory *uses* the graph (a memory item is anchored to entities) but adds the episode +
  outcome + the vector for semantic recall.

The test for every design decision here (the **feeds-the-loop test**): does it make the *next* proposal better
by surfacing a relevant *prior* episode? If a piece doesn't serve recall-that-improves-a-proposal, it's not
MEM.1.

## Goals

1. **`MemoryItem`** — a typed, org-scoped, entity-anchored, embedded episode record (its own table, its own
   pgvector column + HNSW index).
2. **Ingestion** — derive MemoryItems from the *existing* substrate (no new capture): decisions/approvals from
   **AuditLog**, exceptions from **NCR / SpcSample breaches / SafetyIncident**, resolutions from the same
   records' terminal states. Idempotent + backfillable + incremental.
3. **`recallMemory`** — a **hybrid retrieval**: vector similarity ⊕ entity-graph proximity (via EntityLink) ⊕
   recency. Given a natural-language situation and/or a subject entity, return the most relevant prior
   episodes with their outcome + provenance. Registered as a `category:"read"` tool and wired to the Axona
   agent (and available to module agents).
4. **Seed real memory** so the demo has a genuine "we've seen this before" moment: NCR-114 (the *contained*
   prior drive-torque breach) is recallable when reasoning about NCR-118 — the resolution, the approver, the
   supplier action. That recall is the moat made visible.
5. **Close the ONT.1 wiring gap** the recon flagged: ensure the memory tool (and `getBlastRadiusTool`) are in
   `registry.coreTools` so the Axona agent reliably has them (not only via the category filter).

## Non-goals (flag, don't build — keep MEM.1 shippable)

- **Auto-injecting recalled memory into every agent prompt** → **MEM.2** (context assembly). MEM.1 exposes the
  *tool*; the agent calls it. Automatic retrieval-augmentation is the next story.
- **Confidence calibration from memory** → **CONF.1**. MEM.1 provides the recall CONF.1 will consume.
- **The learning loop / outcome feedback writing back to models** → **LOOP.1**. MEM.1 stores outcomes; it does
  not train.
- **Temporal-KG bitemporality (Zep/Graphiti-style valid-time vs. tx-time)** → later (flag as MEM.3). MEM.1
  uses a single `occurredAt` + `createdAt`; note the seam.
- **Telemetry-anomaly *detection*** → TEL.1. MEM.1 can ingest an already-flagged SPC breach as an episode; it
  does not run anomaly detection over raw `TelemetryPoint`/`MachineSignal` streams (leave the typed seam).

## Data model (via `prisma migrate dev` — **NEVER `db push`**, MIGRATE.1)

```prisma
enum MemoryKind { DECISION EXCEPTION APPROVAL RESOLUTION GENEALOGY_EVENT TELEMETRY_ANOMALY }

model MemoryItem {
  id          String     @id @default(cuid())
  orgId       String
  org         Org        @relation(fields: [orgId], references: [id], onDelete: Cascade)
  kind        MemoryKind
  // Natural-language episode summary — the text that gets embedded for semantic recall.
  summary     String
  // Structured anchor into the ontology: what this episode is ABOUT (resolve via EntityLink/getBlastRadius).
  subjectType EntityType?     // reuse the ONT.1 enum — a memory item is anchored to a real record
  subjectId   String?
  // Provenance: the substrate row this was derived from (audit id, ncr id, spc serial, …) — for idempotency.
  sourceType  String          // "AuditLog" | "NCR" | "SpcSample" | "SafetyIncident"
  sourceId    String
  // Outcome/terminal state where known (e.g. "CONTAINED", "APPROVED", "SENT", "rolled back") — the payload
  // that makes recall useful ("last time, the resolution was …").
  outcome     String?
  // Who/what produced the underlying action + (uncalibrated) confidence — mirrors AUDIT.3; CONF.1 calibrates.
  actorLabel  String?
  model       String?
  confidence  Float?          /// uncalibrated agent-emitted signal; CONF.1 calibrates + gates on it
  occurredAt  DateTime        // when the episode happened (from the source), distinct from createdAt
  createdAt   DateTime   @default(now())
  embedding   Unsupported("vector")?   /// vector(1536) + HNSW added in raw SQL; MEM.3 adds bitemporality

  @@unique([orgId, sourceType, sourceId])   // idempotent ingestion — one memory per source event
  @@index([orgId, kind, occurredAt])
  @@index([orgId, subjectType, subjectId])   // graph-proximity recall by subject
}
```

- Reuse the ONT.1 `EntityType` enum for `subjectType` (don't invent a parallel taxonomy).
- The real `vector(1536)` column + **HNSW** (`vector_cosine_ops`) index (`memoryitem_embedding_hnsw`) are
  created in **raw SQL**, and **re-asserted idempotently in the trailing `…_ensure_raw_sql_ddl` migration**
  (the established pattern — Prisma models it as `Unsupported("vector")?`). `migrate status` clean.
- **Add `MemoryItem` to `TENANT_MODELS` in `packages/db/src/client.ts`** so `dbForOrg` auto-scopes it (the
  ISO.1 surface). This is required, not optional — per-tenant isolation of memory is a moat invariant (one
  tenant's memory must never surface in another's recall).

## Ingestion (`packages/db/src/memory/ingest.ts`)

`ingestMemory(db, { since? })` — derives MemoryItems from the substrate, **idempotently** (the
`@@unique([orgId, sourceType, sourceId])` makes re-runs no-ops; supports incremental via `since`):

- **AuditLog → DECISION / APPROVAL** — each gated `decide()` entry becomes an episode: summary from
  action+target+summary, `subject` from targetType/targetId (mapped to `EntityType` where it's an ontology
  entity), `outcome` from the resulting state, carry `actorLabel/model/confidence/approver`, `occurredAt =
  createdAt`.
- **NCR → EXCEPTION (+ RESOLUTION when terminal)** — an open NCR is an EXCEPTION episode; a CONTAINED/CLOSED
  NCR also yields a RESOLUTION episode (this is what makes NCR-114 recallable as "we contained this before").
  `subject = {NCR, code}`.
- **SpcSample breach → EXCEPTION** — a sample outside [LCL,UCL] becomes an episode anchored to its
  characteristic+serial (reuse the runSpcCheck breach logic; don't re-implement the comparison).
- **SafetyIncident → EXCEPTION** — same shape.
- Embed each item's `summary` via `getEmbedder()` (Fake offline/CI, Real behind `EMBED_API_KEY`) →
  `toVectorLiteral` → write the `embedding` column (raw SQL update, like FILE.2/SearchDoc).
- Wire `ingestMemory` into the **seed** (after `seedOntology`) so a freshly-seeded org has memory, and expose
  it for incremental use (a later story / cron can call it; MEM.1 just needs the function + seed call).

**Guardrail:** ingestion **reads** the substrate and **writes only MemoryItem** — it never mutates AuditLog,
NCRs, or any source record. Memory is derived, the sources stay canonical.

## Retrieval — `recallMemory` (`packages/db/src/memory/recall.ts` + the tool)

`recallMemory(db, { query?, subjectType?, subjectId?, kind?, limit = 5 })` → ranked `MemoryHit[]`:

- **Vector** — embed `query`, rank `MemoryItem.embedding` by cosine `<=>` (the FILE.2/semanticSearch pattern),
  org-filtered. Returns [] gracefully when there are no embeddings (Fake embedder still produces
  deterministic vectors, so CI has signal).
- **Graph proximity** — when a `subject` is given, pull memories whose `subject` is the entity **or a
  neighbor** of it in the EntityLink graph (reuse `getBlastRadius` to get the neighborhood, then fetch
  memories anchored to any node in it). This is the "what happened to related parts/suppliers/units" recall
  that file search fundamentally cannot do.
- **Recency + kind** — tie-break/boost by `occurredAt`; optional `kind` filter.
- **Hybrid rank** — combine vector score ⊕ graph proximity ⊕ recency into one ordering (documented weights;
  keep it simple and legible, not a black box). Each hit returns `{ summary, kind, outcome, subject (code+
  label), occurredAt, actorLabel, provenance (sourceType/sourceId), score }` — **real records + provenance,
  never a synthesized memory.**

Expose as `recallMemoryTool` (`category:"read"`), handler `(input, ctx) => recallMemory(ctx.db, input)`. Add
it (and `getBlastRadiusTool`) to `registry.coreTools` so the **Axona agent** reliably carries it; also include
in the relevant module agents (quality, procurement) so a module co-pilot can recall within its domain.
Update `axonaSystemPrompt()` to tell the agent it can recall prior operational episodes (and must cite them).

## Guardrails / moat invariants

- **Per-tenant isolation of memory** (moat invariant): `MemoryItem` in `TENANT_MODELS`; every read/write
  org-scoped; a second org's situation recalls **zero** of the first org's memory (a verify assertion).
- **Memory ≠ RAG-over-PDFs**: no `File`/`SearchDoc` overload; MEM.1's own table; recall combines vector **and**
  graph, which is the structural difference.
- **Derived, not authoritative**: ingestion never mutates the source substrate; `@@unique` guarantees
  idempotence; re-seed/re-ingest is safe.
- **Real records only**: recall returns provenance-bearing hits; the agent cites them; it never fabricates a
  "memory."
- **Confidence stays uncalibrated here** (`///` seam to CONF.1) — carry the field, don't gate on it yet, don't
  add calibration columns.
- **Embedder DI**: Fake in CI (no key), Real behind env — CI must pass with no `EMBED_API_KEY`.
- Migration only via `migrate dev`; raw-SQL vector/HNSW in the trailing ensure migration; `migrate status`
  clean; the seed + any verify that ingests **self-cleans** to the seeded baseline (MIGRATE.1).

## Verify + gate (`src/scripts/verify-mem-1.ts`)

1. `MemoryItem` + `MemoryKind` exist; `MemoryItem` is in `TENANT_MODELS`; `migrate status` clean (authored via
   `migrate dev`); the raw-SQL HNSW index is asserted in the trailing ensure migration.
2. `ingestMemory` is **idempotent**: running it twice yields the same MemoryItem count (the `@@unique` holds).
3. Seed produces memory across **≥3 kinds** (at least DECISION/APPROVAL from audit, EXCEPTION from NCR/SPC,
   RESOLUTION from a contained NCR).
4. **The demo recall works:** `recallMemory({ subjectType:"NCR", subjectId: <NCR-118 id>, query:"drive torque
   stiff actuator" })` surfaces the **NCR-114 RESOLUTION** episode (the contained prior) among the top hits,
   with its outcome + provenance — via graph proximity, not just string match.
5. **Hybrid, not pure-vector:** a subject-anchored recall returns a graph-neighbor memory that a pure-vector
   query on the text alone would miss (assert the graph path contributed).
6. **Tenant isolation:** a second org recalls **zero** MemoryItems from the first org's graph.
7. `recallMemoryTool` + `getBlastRadiusTool` are in `registry.coreTools` (the wiring-gap fix); the Axona
   system prompt mentions recall.
8. Embedder DI: FakeEmbedder path works with no `EMBED_API_KEY` (CI-green offline).

CI gate: install --frozen-lockfile · lint · turbo typecheck · verify:all · **pnpm build** · `migrate status`
clean; commit + push; Actions green.

**Live acceptance (the real DoD):** ask the Axona agent, in the running app, something like *"NCR-118 just
opened — have we seen this before, and how was it handled?"* → the agent **calls `recallMemory`**, and answers
by surfacing the **NCR-114 contained resolution** (with approver/outcome) as prior precedent — demonstrably
recalling a *prior episode* to inform the *current* one. That is the loop's memory node working end-to-end.

## Review gate

Stop after MEM.1; show: the migration (incl. the raw-SQL HNSW), `ingestMemory` idempotency (same count on
re-run), the seeded memory across kinds, `recallMemory` surfacing NCR-114 for an NCR-118 situation **via graph
proximity**, tenant-isolation returning zero cross-org, and — the money shot — **the live Axona agent
recalling the NCR-114 precedent when asked about NCR-118.**
