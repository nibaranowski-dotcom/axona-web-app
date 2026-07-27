# PRD — MEM.2 · Context assembly (auto-inject operational memory into agent prompts)

**Story:** MEM.2 — Automatically retrieve and inject the most relevant operational memory into an agent's
context at decision time, so proposals are informed by prior episodes without the agent having to call
`recallMemory` by hand.
**Spec ref:** `specs/architecture-learnings.md` (L2 — operational memory); backlog E12 row 120. **Pri/size:**
P1 · M. **Track:** Moat (E12). **Depth:** Full-ish CPRD (condensed here). **Deps:** MEM.1/MEM.1a
(`recallMemory` hybrid retrieval), ART.1 (runtime), GA.1 (Axona agent), CONF.1 (calibrated confidence on hits).

## Why (the biggest reliability lever we're not pulling)

Current harness best practice — and the ByteByteGo/12-Factor review — put **context engineering** ("own the
context window; relevance beats volume") as the single largest lever on agent reliability. MEM.1 built the
*retrieval* (`recallMemory` — hybrid vector ⊕ graph-proximity ⊕ recency). But injection is still **manual**: the
agent only benefits if it *decides* to call the tool. MEM.2 makes relevant memory show up in the context
automatically, at the right moment, pruned to what matters — turning retrieval-that-exists into
retrieval-augmentation-that-fires.

## Goals

1. **Auto-assembly** — before/within an agent turn, assemble a **bounded** "relevant memory" block from
   `recallMemory` keyed on the current situation (the subject entity in play, the user's question, the module
   scope) and inject it into the system/context — capped by a token budget (relevance beats volume; never dump
   the whole store).
2. **Grounded, cited, honest** — injected memories carry their provenance + calibrated confidence (CONF.1) so
   the agent cites them and doesn't treat an uncertain recall as fact. Below the memory-confidence floor, don't
   inject.
3. **Per-tenant + scoped** — assembly reads only the current org's memory (isolation invariant) and only what's
   relevant to the current subject/module — not everything.
4. **Prune, don't drown** — the assembled block has a hard size cap; when over budget, keep the highest-scoring
   hits (graph-proximity + recency + vector), drop the rest. Coordinate with RUNTIME.1's loop pruning so memory
   injection doesn't blow the window.

## Non-goals (flag)

Changing the memory *store* (that's MEM.1) · confidence *calibration* (CONF.1) · the learning loop / writing
outcomes back to models (LOOP.1) · bitemporal memory (MEM.3). MEM.2 is retrieval → context only.

## Approach

- A `assembleContext(db, { orgId, subject?, query, moduleScope, tokenBudget })` that calls `recallMemory`,
  ranks, prunes to budget, and returns a formatted, cited block + the hit provenance.
- Wire it into the agent runtime so the Axona agent (and module agents) get the block on turns where a subject
  is in play or the question implies precedent ("have we seen this before"), without a manual tool call. Keep the
  explicit `recallMemory` tool too (belt and suspenders).
- Make the injection **legible in the trace** (a `memory` trace line: "injected N prior episodes, top =
  MISPICK-114 CONTAINED") so it's demoable and auditable.

## Guardrails

Per-tenant isolation (org-scoped) · bounded token budget (no window-drown) · cited + confidence-gated (no
uncited/low-confidence injection) · honest cold-start (no memory → inject nothing, don't fabricate) · the agent
still proposes→approve→audit (memory informs, never auto-acts).

## Verify + gate (`src/scripts/verify-mem-2.ts`)

1. `assembleContext` returns a **bounded** block (respects the token budget; over-budget drops lowest-scoring
   hits) and is org-scoped (a 2nd org gets zero of the 1st's memory).
2. For an NCR-118-shaped situation, the assembled block contains the NCR-114 precedent **without** the agent
   calling `recallMemory` manually (auto-injection fired).
3. Low-confidence / cold-start → nothing injected (no fabrication); the trace shows the injection decision.
4. Existing MEM.1/CONF.1 verifies stay green.
CI gate: install --frozen-lockfile · lint · turbo typecheck · verify:all · pnpm build · migrate clean; commit +
push; Actions green.

## Live acceptance

Ask the Axona agent a bare question about NCR-118 (without prompting it to recall) → its answer already reflects
the NCR-114 precedent, and the trace shows a `memory` line proving auto-injection. The loop's memory node now
feeds the model *by default*.
