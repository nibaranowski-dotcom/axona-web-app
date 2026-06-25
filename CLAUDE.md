# CLAUDE.md — Axona Web App (the product)

## What this is
The **Axona product** — the AI-native **operating system for robotics companies** (always "operating
system," never "ERP"). Covers the whole robot lifecycle (design → procure → build → test → sell →
deliver → deploy → service) as modules unified by a horizontal **Core** layer and a fleet of cooperating
**agents**. This is the real app — distinct from the marketing site (`../Axona-Commercial-Website`).

Full product spec (source of truth for everything below): **`specs/axona-build-spec.md`** — product
overview, 24-module screen list w/ user stories, Prisma data model, multi-agent architecture, API
surface, frontend structure, RBAC, project skeleton, and tokens. Build from it.

Company context (story, ICP, competition, moat, people) lives one level up in `../memory/` and `../company/`.

## One-line
Humans + machines + agents on one system; the wedge is **agentic procurement + per-unit build genealogy**;
the moat is the **multi-agent intelligence layer** (specialized models + memory + the learning loop).

## Brand invariants (do not drift — from build spec §0/§10, matches the site)
Archivo (UI/display) + JetBrains Mono (data/labels) · paper `#ffffff`, panel `#f4f3ef`, ink `#0a0a0a` ·
single accent **lime `#c6f24f`** · functional green `#1f9e6f` for live/approved (no invented reds —
critical states use ink) · hairlines over shadows · dotted-grid motif · **no emoji**. Tokens: `design.md`.

## Stack (from build spec §2 — pin/verify at scaffold)
Monorepo (pnpm + Turborepo) · TypeScript · Next.js (App Router) + React · Tailwind + CSS-var tokens ·
TanStack Query + Zustand · Prisma + PostgreSQL (multi-tenant by `orgId`) · BullMQ (Redis) agents/workflows ·
SSE for agent/run traces · Auth.js + RBAC · pgvector + Postgres FTS search · Claude via a thin
`AgentRuntime` (tool-use loop) · S3 blob store. Note: **product-app stack ≠ marketing-site stack** —
don't reconcile the two; this app follows the build spec.

## How to build (from build spec §0 + §9)
1. Scaffold the monorepo + deps (§9). 2. Data model (§3) as Prisma + seed the cross-module narrative
(§3.7). 3. API (§6) + agent runtime (§5). 4. Frontend shell (§7) → screens in §4 order (Core first).
Each screen: **Purpose → Data → User stories → Components → Agents.** Build order/milestones in §9.

## The moat (don't dilute)
Every module runs ~6 specialized agents under a module orchestrator; a general **Axona agent** reads
across modules. Agents **draft/monitor/act; humans approve** (money/safety/contract gated by a state
machine). Per-role **guardrails** + full **audit trace**. Per-unit genealogy + traces = the proprietary
data/label substrate that compounds. (See `../memory/research.md`, `../company/technical-moat-for-julia.md`.)

## Architecture spine & moat invariants (from `specs/architecture-learnings.md`)
Four layers over one spine: **L1 Foundation** (connectors · ontology · genealogy · immutable event log)
→ **L2 Intelligence spine** (operational memory · specialized models · agent runtime · learning loop) →
**L3 Domain apps** (the 24 modules) → **L4 Vertical editions**. **Only L2 compounds — it is the moat;**
L1/L3/L4 are competitive necessities. Build/care follows that asymmetry.

Non-negotiable engineering invariants (apply to every story, regardless of P-level):
- **Capture fidelity caps the moat.** Per-unit genealogy is captured **as-built** (parts·serials·firmware),
  never reconstructed. Telemetry (fleet + plant) is a **first-class typed input**, not an afterthought.
  Shape these correctly from day one even while the learning loop is stubbed — retrofitting is the top risk.
- **Memory ≠ RAG-over-PDFs.** Operational memory is a structured graph + vector over
  decisions/exceptions/approvals/genealogy/telemetry. Don't conflate it with file search.
- **Propose → approve → audit is the product.** Every agent action logs **inputs · output · model ·
  confidence · approver** to an **immutable event log**. `confidence` is a real calibrated field that
  gates autonomy — not decoration. Autonomy is earned via a progressive-trust ladder (a designed,
  measured surface, not implicit).
- **`guardrails.config` is enforced data**, not a marketing line: never auto-place an order · never claim
  stock without a source · never invent a supplier or lead time.
- **Per-tenant isolation of data *and* models.** One tenant's data/models never leak into another's;
  this also protects the "config, not rebuild" transfer story. VPC / own-your-model is a GTM unlock.
- **Feeds-the-loop test.** Score work on whether it feeds `data → memory → models → better proposals →
  outcomes → data`. If it doesn't touch the loop, it's table stakes, not moat.
- **Wedge = Procurement.** First domain co-pilot and the spine's proving ground (long-lead sourcing +
  BOM churn + genealogy). Moat-load-bearing stories: `MFG.1`, `FLEET.1`/`MACH.1`, `AUDIT.1`, `ART.5`.

## Integrity / never (inherited from ../CLAUDE.md)
- The cross-module seed narrative names **BMW / Kawasaki** — these are **fictional sample data**. Inside
  the app, sample data is fine and labeled; **anything leaving the app** (decks, screenshots, marketing)
  must anonymize them → "Tier-1 auto OEM," etc. Never imply a real customer/person.
- Never ship invented traction/metrics externally. AI proposes; a human approves money/safety/contract.

## Deliverable to the decks — the screen export
This project (the only one with the real screens) produces the **simplified deck-crops** for the pitch +
sales decks. Run **`specs/screen-export-instruction.md`** → write the two files into `exports/`:
- `exports/screens-export-seed.md` → used by `../company/deck/content-addon-product.md`
- `exports/screens-export-sales.md` → used by `../company/deck/sales-content-addon-product.md`
Treat as **human-gate**: Nicolas signs off the anonymization + "sample data" labels before any deck ships.

## Definition of done (per screen/story)
Matches the build spec: real data via the model, agent trace where relevant, human-in-the-loop on gated
actions, RBAC enforced, v2 tokens only (no raw hex), feels like Linear/Harvey-class. `tsc --noEmit` clean.

## Cowork workflow preference (Nicolas)
When Nicolas is driving the build, this Cowork tab is the PM/Joe layer; Claude Code (separate terminal
tab) implements. **Default output = a ready, copy-paste block to hand to Claude Code** — the literal text
he pastes, in a single fenced code block, no surrounding commentary unless he asks. The block names the
story (e.g. FND.2), its requirements, and ends with "stop after <story> and show me X before continuing."
Work the backlog (`backlog.md`) in order; when he says "next" (or a StoryID), emit the next block. He'll
review each story in Claude Code, then return to ask for the next. Backlog rows are also CPRD-triggerable
if he wants a full PRD first.
