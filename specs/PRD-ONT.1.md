# PRD — ONT.1 · Entity-link graph + blast radius (the cross-module ripple)

**Story:** ONT.1 — A typed entity-link graph over the domain models, a `getBlastRadius` traversal tool, and
the seeded NCR-118 cascade. Plus the `runSpcCheck` correctness fix.
**Spec ref:** `specs/architecture-learnings.md` **L1 Foundation → ontology**; build spec §3 (data model), §5
(agent runtime). **Pri/size:** P0 · M–L. **Track:** Moat (E12). **Depth:** Full CPRD — **moat-load-bearing.**
**Deps:** the domain models (NCR, ECO, Part, Supplier, PurchaseOrder, Unit/serial genealogy, Delivery,
WorkOrder, SpcSample), the agent runtime (ART.1/ART.2), the tool registry (`packages/agents/src/tools/`).

## Problem (found by dry-running the demo, not by reading code)

Asked live — *"What's the blast radius of NCR-118?"* — the Axona agent correctly answered:

> "No ECOs, work orders, supplier records, or part SKUs surfaced as directly tied to this NCR. Those links
> have not been created yet in the system."

It is not hallucinating; it is right. The schema says so:

```prisma
model NCR {
  linkedTo String
  /// String reference into the genealogy/quality graph (e.g. "lot 88421") — kept
  /// a plain string, not an FK (crosses to ONT.2, out of FND.11 scope).
}
```

We deferred entity links to "ONT.2, later." But **the cross-module ripple is the single strongest moment in
the pitch** — "one control-chart breach, six modules affected, one question" — and that story *is* the link
graph. It cannot be told without it, and it cannot be faked: a hand-joined string match works for NCR-118 and
collapses the moment anyone asks about a second NCR.

Per the architecture invariants: **capture fidelity caps the moat**, and **retrofitting the link layer is the
top risk**. This is the retrofit. Do it properly now, while the surface is small.

Secondary bug, same root (the agent can't see what the screen shows): `runSpcCheck({characteristic:"Drive
torque"})` returns **zero breaches** while the Quality SPC chart renders **24 points with 2 over the UCL**.
The tool and the chart must agree — an agent that can't see what the operator sees is not a co-pilot.

## Goals

1. **`EntityLink`** — a typed, org-scoped, bidirectionally-indexed link graph over the existing domain models.
   This is the L1 ontology edge table: the spine everything else hangs from.
2. **`getBlastRadius`** — a depth-limited graph traversal exposed as an agent tool: given an entity, return
   every connected record, grouped by module, with the relation path that got there.
3. **Seed the NCR-118 cascade end-to-end** so the demo's Act 4 is *true*: Quality → Engineering → Procurement
   → Manufacturing (genealogy) → Fulfillment → Field Service → Finance.
4. **It must generalize.** A second NCR (NCR-114, the contained one) traverses too. Nothing hardcoded to
   NCR-118 — if the traversal only works for the demo record, this story has failed.
5. **Fix `runSpcCheck`** so it reports the same breaches the SPC chart renders.

## Non-goals (flag, don't build)

A blast-radius **UI** (a ripple view on the NCR screen) → **ONT.2**. Automatic link *inference* (agents
proposing links from telemetry/text) → **ONT.3** — this story creates links from the seed and from explicit
writes only. Full ontology coverage of all 24 modules → later; seed the cascade the narrative needs.

## Data model (via `prisma migrate dev` — **NEVER `db push`**, per MIGRATE.1)

```prisma
enum EntityType { NCR ECO PART SUPPLIER PURCHASE_ORDER UNIT LOT DELIVERY WORK_ORDER SPC_SAMPLE INVOICE }
enum LinkRelation { CAUSED_BY AFFECTS RESOLVED_BY SUPPLIED_BY CONTAINS SHIPPED_IN DISPATCHED_FOR IMPACTS }

model EntityLink {
  id        String       @id @default(cuid())
  orgId     String
  fromType  EntityType
  fromId    String       // the record's id (resolve code→id at seed/write time)
  relation  LinkRelation
  toType    EntityType
  toId      String
  note      String?      // human-readable why — surfaces in the agent's answer
  createdAt DateTime     @default(now())

  @@index([orgId, fromType, fromId])
  @@index([orgId, toType, toId])   // traversal must be fast in BOTH directions
  @@index([orgId, relation])
}
```

Derive the exact enum members from the **real** models in `schema.prisma` — don't invent entities that don't
exist. Keep `NCR.linkedTo` for now (don't break callers); the graph supersedes it, and dropping it is ONT.2.

**Moat pointer (`///`, no new columns):** links are the substrate the learning loop reads (`MEM.1`) — an
agent-proposed link will later carry `confidence` + `approver` like any other proposal. Do **not** add those
columns now.

## Traversal (`getBlastRadius`)

`getBlastRadius({ entityType, code, maxDepth = 3 })` — BFS over `EntityLink` from the seed node, **following
edges in both directions**, deduping visited nodes, capped by `maxDepth` and a node cap. For each node,
resolve the real record (code · label · status) and tag its **module**. Return grouped by module, each entry
carrying the **relation path** that reached it (`NCR-118 —CAUSED_BY→ SERVO-204 —SUPPLIED_BY→ Actuator Co`).

Register it in the tool registry (`category: "read"`) and make it available to the **Axona cross-module
agent** and the Quality module agent. It must return **real records only** — never a summary the model
invented. If nothing is linked, it says so (the current honest behavior is the floor, not the ceiling).

## Seed — the NCR-118 cascade (`packages/db/prisma/seed/`)

Wire the narrative that the deck crops and `docs/demo-script.md` already promise:

- **Quality** — NCR-118 (drive torque over UCL, stiff actuator) ← the breaching SpcSamples.
- **Engineering** — the ECO opened against the actuator (`CAUSED_BY` / `RESOLVED_BY`).
- **Procurement** — the affected part SKU + its supplier + the PO covering the suspect lot.
- **Manufacturing** — the **lot**, and the **unit serials** that consumed it (this is the genealogy edge —
  the whole point: the system knows which units got the bad actuator).
- **Fulfillment** — the deliveries carrying those units.
- **Field Service** — the work orders on the deployed affected units.
- **Finance** — the cost/credit exposure.

Also link **NCR-114** (same defect, contained) into its own smaller cascade, so generalization is proven, not
asserted. Keep names anonymized per the integrity rule (Tier-1 auto OEM / generic vendors).

## `runSpcCheck` fix (`packages/agents/src/tools/quality.ts`)

Today: exact-match on `characteristic`, `orderBy ts desc`, `take LIST_CAP`, filter outside `[LCL, UCL]` → it
returned 0 breaches against a chart showing 2. **Diagnose the actual cause before fixing** (characteristic
string mismatch vs. the chart's? breaching points outside the `LIST_CAP` window? stored `ucl` disagreeing
with what the chart draws?) — then make the tool report what the chart shows. Add the linked NCR to its
output where one exists. Do not paper over it by widening `take` if the real cause is a name mismatch.

## Guardrails

`orgId`-scoped on every read/write (the session's org is the tenant boundary — never client-supplied); RBAC
unchanged; links are **facts, not proposals** in this story (no agent-invented edges — that's ONT.3); the
agent cites real record codes and never fabricates a link; migration only via `migrate dev`, `migrate status`
clean; verify scripts self-clean.

## Verify + gate (`src/scripts/verify-ont-1.ts`)

1. `EntityLink` + enums exist; `prisma migrate status` clean (authored via `migrate dev`, no `db push`).
2. The seed creates the NCR-118 cascade: links resolve across **≥6 modules** (Quality, Engineering,
   Procurement, Manufacturing, Fulfillment, Field Service).
3. `getBlastRadius("NCR", "NCR-118")` returns nodes from **≥5 distinct modules**, each a **real record** with
   its relation path; traversal is bidirectional and depth-capped.
4. **Generalization:** `getBlastRadius("NCR", "NCR-114")` also returns its (smaller) real cascade — nothing is
   hardcoded to NCR-118.
5. `runSpcCheck({characteristic:"Drive torque"})` reports the **same 2 breaches the SPC chart renders**.
6. Cross-tenant isolation: a second org's entity returns **zero** links from the first org's graph.

**Live acceptance (the real DoD):** ask the Axona agent **"What's the blast radius of NCR-118?"** → it answers
with real records from Quality, Engineering, Procurement, Manufacturing, Fulfillment, and Field Service, with
no "these links have not been created" gap. That sentence disappearing is the story being done.

CI gate: install --frozen-lockfile · lint · turbo typecheck · verify:all · **pnpm build** · `migrate status`
clean; commit + push; Actions green.

## Review gate

Stop after ONT.1; show: the migration, the `EntityLink` graph as seeded, `getBlastRadius` output for NCR-118
**and** NCR-114, `runSpcCheck` now agreeing with the chart, and — the money shot — **the live agent answering
the blast-radius question across six modules.**
