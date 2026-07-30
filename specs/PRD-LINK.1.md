# PRD — LINK.1 · Connected-objects / where-used navigation (universal, on ONT.1)

**Story:** LINK.1 — a **horizontal** "Connected objects" panel on every entity detail view: show the record's
**directly linked entities** (both directions, grouped by relation, with the "why"), each a **one-click link** to
that entity's detail. It surfaces the ONT.1 graph we already own as *navigation everywhere* — the "2–3 clicks to
any connected object" requirement — and makes 24 modules feel like **one operating system**. It generalizes the
ONT.1 traversal; it does **not** build a parallel graph.
**Spec ref:** `specs/horizontal-prd-candidates.md` (Tier 1). **Pri/size:** P1 · M. **Track:** platform-horizontal
(rides the moat's ONT.1 spine). **Depth:** Full-ish CPRD. **Deps:** ONT.1 `EntityLink` +
`getBlastRadius`/`recall` edge traversal (`packages/agents/src/tools/ontology.ts`, `packages/db/src/memory/
recall.ts`), the per-type natural-key/label resolver, the entity detail routes, RBAC (read).

## Non-negotiable — BUILD ON ONT.1 (do not reinvent)

Same discipline as IO.1:
1. **Extract, don't duplicate the traversal.** Lift the **1-hop neighbor fetch** (the `entityLink.findMany` on
   `fromId=X` ∪ `toId=X`) that `getBlastRadius` and `recall` already do into a shared **`getEntityLinks(db, {
   type, id })`**. Then **`getBlastRadius` becomes a BFS *over* `getEntityLinks`** — its behavior UNCHANGED,
   `verify:ont-1` stays green. LINK.1's panel and `recall` both call the same `getEntityLinks`. **One edge query,
   one traversal — no parallel graph.**
2. **Reuse the per-type natural-key / label resolver** (already in `recall.ts` §"getBlastRadius natural keys per
   type") to render each neighbor's label; do not invent a second resolver.
3. **Reuse the entity-type → detail-route mapping** (whatever `BlastRadiusView` uses for drill-in); centralize it
   if it's ad-hoc, but don't fork it.
A reviewer must see LINK.1 = the ONT.1 1-hop neighbor fetch + label resolver + a shared panel — not a new graph.

## Distinct from blast radius (spec the boundary)

- **LINK.1 = 1-hop, navigation.** "What is *directly* connected to this record, and where is it used" — immediate
  neighbors, one click away. On every entity detail.
- **Blast radius = N-hop, impact analysis.** The full cascade for an ECO/lot/part-rev — its own screen. LINK.1
  does **not** re-implement multi-hop; blast radius owns it (and now calls the shared `getEntityLinks`).

## Scope

- **`getEntityLinks(db, { type, id })`** → the record's neighbors resolved to `{ type, id, label, route,
  relation, direction (out/in), note }`, both directions, grouped by relation. Org-scoped (`dbForOrg`).
- **A shared `<ConnectedObjects>` panel** (grouped by relation; each neighbor a one-click link to its detail
  route; the `note` shows the "why"; empty state when a record has no links).
- **Surface it on the key entity detail views** first (the PLM + procurement spine where links are richest):
  Unit, NCR/RCA, Change order (ECO), Configuration, Test run, PO/Procurement, Part/Inventory — then generalize.
  (Match the existing detail-view layout; don't disturb the signature artifact — the panel is a secondary rail.)
- v2 tokens · no emoji · Lucide thin icons · a11y (links labeled, keyboard-operable).

## Guardrails

Org-scoped · **read RBAC** · **reuse the ONT.1 traversal** (`getEntityLinks` is the single 1-hop primitive;
`getBlastRadius` refactors to use it, unchanged) · reuse the natural-key/label + route resolvers (no parallel
copies) · 1-hop only (blast radius owns multi-hop) · the `note` surfaces the human-readable why · **no schema
change** (`EntityLink` exists) · migrate clean · additive only.

## Verify + gate (`src/scripts/verify-link-1.ts`)

1. **Build-on-top proof:** `getBlastRadius` behavior byte-unchanged after refactoring onto `getEntityLinks`;
   `verify:ont-1` stays green.
2. `getEntityLinks(seeded entity)` returns its **direct** neighbors both directions with correct
   labels/relations/routes; org-scoped (a 2nd org → 0).
3. The `<ConnectedObjects>` panel renders on ≥5 entity detail views with **working one-click links** to the right
   detail routes; empty state when unlinked.
4. **Reuse proof:** exactly one 1-hop edge fetch (`getEntityLinks`), shared by blast radius + recall + LINK.1
   (assert no second `entityLink.findMany`-based traversal / no forked resolver).
5. **Boundary:** LINK.1 is 1-hop (does not re-implement multi-hop cascade).
6. a11y 0 on the touched routes; existing ONT/PLM/MEM verifies stay green; migrate clean.
CI gate: install --frozen-lockfile · lint · turbo typecheck · verify:all · pnpm eval (offline) · pnpm build ·
migrate clean; commit + push; Actions green.

## Review gate

Stop after LINK.1; show: `getBlastRadius` unchanged + `verify:ont-1` green (the build-on-top proof); the
`<ConnectedObjects>` panel on 2–3 detail views (Unit, NCR, ECO) with working one-click traversal + the `note`
"why"; org-scoped isolation; and confirmation there's one shared 1-hop traversal (no parallel graph).
