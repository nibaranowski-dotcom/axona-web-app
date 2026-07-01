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

**Canonical design system = DS.1 (imported via the `claude_design` MCP → `Design System.dc.html`).** The
implemented tokens + primitives in `design/` are the visual source of truth; `design.md` is reconciled to
match it (brand invariants above still win on any conflict). `FND.14`/`FND.15` (data + agent primitives)
build on DS.1's components, not parallel to them.

**Per-screen design source = the committed `Axona v2` export at `design/prototypes/axona-v2/`** (exported
from the `claude_design` project `30c1e297…`; ~26 `.dc.html` files, one per screen, + `tokens/`,
`components/`, `guidelines/`, and handoff `.md` docs). This is the canonical fidelity reference — it
supersedes the older DS.1-era `design/prototypes/` set. **Every UI story implements its screen 1:1 against
its local `.dc.html`** (Claude Code reads the file directly — no MCP/connector round-trip, no re-auth).
The block names the file: "implement `design/prototypes/axona-v2/<Screen>.dc.html` 1:1 on the DS.1
primitives." Route→file map: the file name is the module's display name (`/sales` → `Sales & CRM.dc.html`,
`/core` → `Command Center.dc.html`, `/agents` → `Agents.dc.html`, `/procurement` → `Procurement.dc.html`,
…). `uploads/` (40MB binaries), `.DS_Store`, `.thumbnail`, `screenshots/` are gitignored — only the
`.dc.html` + tokens + docs are committed. Data/API-only stories skip this (no screen). Visual fidelity is
part of the DoD, checked per story — never a later pass.

**Design intent (from the v2 handoff — `design/prototypes/axona-v2/{axona-build-handoff,readme}.md`):**
- **Icons = Lucide** (thin ~1.5px stroke) for platform functional icons (nav, table actions); the brand is
  otherwise near-icon-free (mono labels · "·" separators · dots/squares/skeletons). **No emoji, ever.**
- **Function-first, signature-artifact per module — no generic-table slop.** Each module screen leads with
  its signature artifact (Procurement=PO queue · Quality=SPC control chart · Fulfillment=delivery pipeline
  Alloc→…→Active · Sales=funnel + deliverability · Field Service=dispatch board · Engineering=HW↔firmware
  compat matrix · People=cert matrix · Fleet=map/telemetry · Autonomy=autonomy-rate trend).
- **Voice/copy:** numbers are **mono + specific** (read like a machine reported them); **sentence case**
  except **UPPERCASE mono eyebrows/labels**; "·" separators; lead with outcomes not module names.
- **The v2 DS ships real components** (`components/core|surfaces|forms/*.jsx` + `.prompt.md`) — port/
  reconcile our primitives to these, don't reinvent. Layout: **240px sidebar** · 60px topbar · 16–28px gaps
  (the handoff prose said 232px but the actual `.dc.html` `<aside>` is 240px — the file wins).
- Build gotcha: `Sales & CRM.dc.html` must be hand-edited (its `&` breaks the design's find/replace scripts).

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

**One story → commit → next (hard rule).** Never hand over a new build block while the previous story is
uncommitted — that entangles two stories in one working tree. Every block must open with the approve +
commit + push of the prior story *before* the next build line. If the tree ever carries two stories,
split into two clean commits (one per story), never a single combined `git add -A`.

**PRD depth — hybrid (Nicolas's call).** Not every story needs a full CPRD. Choose per story and tell
him which mode the block is:
- **Condensed block** for mechanical stories — Prisma schemas, config/tooling, simple data/API CRUD.
- **Full CPRD PRD** (Joe's complete format, written into `/specs`) for complex or moat-load-bearing
  stories: agent runtime + workflow engine (`ART.*`, `WF.*`, `GA.1`), RBAC/approval/audit (`RBAC.*`,
  `AUDIT.*`), search/files/extraction (`SRCH.*`, `FILE.*`, `MTX.*`), `FND.11` (org-scoped client +
  isolation pass), the module screens that carry agents/AI outputs, auth/billing flows, and the whole
  moat layer (E12–E14: `ONT/MEM/CONF/TRUST/LOOP/SLM/GUARD/ISO`).
Every block — condensed or full — must still pass the 6-point completeness check before sending:
(1) names story + spec ref, (2) carries every requirement from the backlog row + spec, (3) enforces the
DoD (orgId scoping · RBAC where it applies · v2 tokens · verify script · manual-checks · `tsc` clean),
(4) states real dependencies, (5) flags moat-load-bearing concerns, (6) ends with a review gate.

**Condensed-block template (proven on FND.5–9 — reuse this shape):**
1. *Approve-prior + push* (when applicable): `<StoryID-prev> approved. git add -A && commit "<StoryID> — <title>" && AXONA_ALLOW_MAIN_PUSH=1 git push.`
2. *Build line:* `Build Story <StoryID> — <title> (<spec §ref> verbatim).`
3. *Core requirements:* implement the spec section exactly (exact field names/types/enum values);
   tenancy pattern (scalar `orgId` + `@@index`, FK indexes, no formal relations — deferred to FND.11);
   `prisma validate/format` clean + `generate` succeeds; no live migration until FND.11.
4. *Additions beyond the plain spec* — call these out explicitly and bound them:
   - **Read-path indexes (no new columns):** e.g. `@@index([characteristic, ts])`, `@@index([stage])`.
   - **Moat `///` pointers (no new columns):** point each at the future story that extends it
     (genealogy→ONT.2 as-built; agent-drafted+status→RBAC.4/AUDIT.3; telemetry/SPC→MEM.1). Never add
     the event-log/confidence/approver columns early.
5. *Guardrails:* "no new columns," "no over-build," "no live migration" — say what NOT to do.
6. *Verification + gate:* `verify-<story-id>.ts` + `docs/manual-checks.md` entry, `tsc --noEmit` clean,
   then **"Stop after <StoryID> and show me <the schema/artifact> before continuing."**
Keep it dense — opinionated, real field/index/file names, no filler.
