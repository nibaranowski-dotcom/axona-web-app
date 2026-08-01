# Axona — Build Overview

*Internal status document · what has been built to date · generated 2026-07-29*

This is a factual account of the Axona product build. Every number here is a real repository
metric (models, migrations, verified stories, screens), not a traction or usage claim. All sample
data in the app is fictional and anonymized (no real company or person names anywhere in the repo).

---

## 1. What Axona is

Axona is the AI-native **operating system for robotics companies** — one system where **humans,
machines, and agents** run the whole robot lifecycle (design → procure → build → test → sell →
deliver → deploy → service). Twenty-four domain modules sit on a shared horizontal **Core**, unified
by a fleet of cooperating **agents** that draft, monitor, and act while humans approve anything
touching money, safety, or contracts.

The wedge is **agentic procurement + per-unit build genealogy**. The moat is the **multi-agent
intelligence layer** — specialized behavior, operational memory, and a learning loop that compounds
on proprietary per-unit data. In-product and buyer-facing copy never says "ERP" or "PLM"; the
positioning is "the operating system for how robotics companies run," and engineering-facing framing
is "configuration management and traceability."

## 2. Product north star — Record → Sense → Predict → Act

The product's data-maturity arc has four layers:

1. **Record** *(current focus)* — the AI-native system of record for how a robotics company runs:
   per-unit genealogy, procurement, quality, as-built, test, RCA, change control. This is the wedge
   and the labeled-data bootstrap.
2. **Sense** — live station-level process/sensor signal on the line.
3. **Predict** — failure/defect prediction from the assembled substrate.
4. **Act** — autonomous execution, human-approved.

**Only Record is being built now.** The upper layers are deliberately deferred, but the schema and
the propose→approve→audit runtime are shaped so they plug in without a retrofit — the typed seams for
Sense (station signal) and Predict (per-unit outcome labels) are already laid (story `SEAMS.1`). The
propose→approve→audit runtime *is* the path to Act: the same loop with more earned trust.

## 3. Architecture spine

Four layers over one spine:

- **L1 · Foundation** — connectors, ontology, per-unit genealogy, an immutable event log.
- **L2 · Intelligence spine** *(the moat)* — operational memory, specialized agent behavior, the
  agent runtime, and the learning loop. **This is the only layer that compounds.**
- **L3 · Domain apps** — the 24 modules.
- **L4 · Vertical editions** — later.

Care and investment follow that asymmetry: L1/L3/L4 are competitive necessities; L2 is the moat.

## 4. Technical foundation

A TypeScript monorepo (pnpm + Turborepo):

- **`apps/web`** — Next.js (App Router) + React; TanStack Query + Zustand; Tailwind on CSS-variable
  design tokens; SSE for live agent/run traces.
- **`apps/worker`** — BullMQ (Redis) background worker for agents and workflows.
- **`packages/db`** — Prisma + PostgreSQL, multi-tenant by `orgId`, with pgvector + Postgres FTS for
  search. **73 Prisma models across 37 migrations.**
- **`packages/agents`** — the agent runtime (tool-use loop), the multi-agent matrix, tools, and the
  workflow engine.
- **`packages/config`** — shared configuration.

Auth.js + role-based access control; an S3-compatible blob store; Claude via a thin `AgentRuntime`.
Schema changes go only through Prisma migrations (never `db push`) so the hand-authored raw-SQL DDL
(FTS `tsv`/GIN, pgvector `vector(1536)`/HNSW) is preserved.

**Scale of the build:** 73 data models · 37 migrations · **139 verified stories** (each ships with a
self-checking verification script gated in CI) · 54 committed design screens · 62 spec/PRD documents.

## 5. What's been built

### 5.1 Platform & foundation
Org-scoped multi-tenant client with strict per-tenant isolation of data *and* models; Auth.js login,
onboarding, invites, email verification and password reset; RBAC with a `decide()` approval state
machine; an **immutable audit event log** recording inputs · output · model · confidence · approver
for every agent/human action; hybrid search (pgvector ⊕ Postgres FTS); file storage + extraction; the
agent runtime and a workflow engine; the Command Center (Core) with cross-module exception rollups.

### 5.2 The 24 domain modules
Each module leads with its **signature artifact** (no generic-table slop): Procurement (PO queue),
Quality (SPC control chart), Fulfillment (delivery pipeline), Sales & CRM (funnel + deliverability),
Field Service (dispatch board), Engineering/PLM (HW↔firmware compat matrix), People (cert matrix),
Fleet (map/telemetry), Autonomy (autonomy-rate trend), Manufacturing (line-flow + genealogy),
Inventory, Finance, Legal, Security, Marketing, Machines, Projects, Workflows, Agents, plus the Core
Command Center, Audit trail, and Settings. All are real data via the model, RBAC-enforced, with agent
assistance surfaced as proposals.

### 5.3 The PLM program — the differentiator *(Engineering / configuration & traceability)*
The per-unit genealogy and traceability layer that answers the five questions incumbents don't:
as-designed vs as-built, configuration management, test traceability, root-cause, and change control.
Shipped as a full screen set on the same spine:

- **Data layer** — the `Unit` spine (the billing meter), `AsBuiltRecord`, `UnitSoftwareState`,
  `ConfigurationVersion`, `TestRun`/`TestResult` with frozen config snapshots, `FieldEvent`,
  `ChangeRequest`/ECO, `NCR.rootCause`; time-resolved config (`resolveConfigAt`), `asBuiltDiff`,
  `affectedUnits`, `freezeConfigSnapshot`.
- **Screens** — Unit registry, Unit page, As-built diff, Blast radius, Test explorer, Test run, RCA
  workspace, Change order, Change orders list, Configurations, Configuration detail (dual-approver
  lock + frozen baseline). Plus v2 upgrades to Engineering, Quality, Manufacturing (as-built
  capture), Fleet, Field Service, and Inventory.
- **Capture fidelity** — per-unit genealogy is captured **as-built** (parts · serials · firmware),
  never reconstructed. This is the proprietary, compounding data substrate.

### 5.4 The moat — L2 intelligence spine *(complete end-to-end)*
The compounding loop is fully wired, each edge real rather than stubbed:

- **ONT.1** — entity-link graph + bidirectional blast-radius traversal (the ripple).
- **MEM.1 / MEM.2** — operational memory (hybrid vector ⊕ graph-proximity ⊕ recency recall), now
  **auto-injected** into agent context at decision time.
- **CONF.1** — calibrated confidence (per-org isotonic map) that gates autonomy — a real field, not
  decoration.
- **TRUST.1** — a progressive-trust ladder: each agent's autonomy rung is *earned and measured* from
  its audited track record + calibration, with a hard ceiling that keeps money/safety/contract
  actions human-approved. (No autonomy is actually granted yet — Record only.)
- **LOOP.1** — the learning-loop writeback: a human's verdict (approve/override/reversal) becomes a
  memory episode the *next* proposal learns from, plus a labeled substrate for recalibration.
- **AUDIT.1** — the immutable event log underpinning all of the above.
- **RUNTIME.1** — agent-loop hardening (bounded context, token caps, run accounting).

Retrieve → inject → calibrate → trust → learn → (back to retrieve). Model *retraining* is
deliberately stubbed; the data flow that feeds it is real, so it plugs in without a retrofit.

### 5.5 Design system
The Axona v2 visual system: Archivo (display) + JetBrains Mono (data/labels), paper/panel/ink
surfaces, a single lime accent, functional green for live/approved, hairlines over shadows, a
dotted-grid motif, Lucide icons, no emoji. 54 per-screen design exports are the pixel-fidelity
reference; each UI story is implemented 1:1 against its committed `.dc.html`.

### 5.6 Prospect demo tenants
Two isolated, tailored demo tenants — a European defense-robotics prospect (PLM-led) and a logistics
manipulation prospect — each fully seeded and org-isolated, using anonymized OEM labels. Built on a
committed, marque-free prospect-seed mechanism with per-prospect config kept out of the repo.

### 5.7 Quality & hardening
A CI-gated accessibility axe scan (WCAG target) on every route in both sidebar states; an offline
agent/prompt **eval harness** that regression-locks tool selection, structured-output robustness,
grounding, the moat behaviors, and the system-prompt contracts; a 139-check `verify:all` suite; a
migration-safety discipline; and a repo-wide anonymization scanner that fails CI on any real marque.

## 6. Go-live status

- **App (`axona-web-app`)** — runs locally (`localhost:3001`). The Railway deploy configuration is
  **authored and committed** (web + worker Dockerfiles, `railway.json` with `migrate deploy` as the
  release step, an `/api/health` probe, `.env.production.example`, and a runbook) but **not yet
  deployed**. Hosting decision: **all on Railway** (web + worker + Postgres + Redis; Cloudflare R2 for
  blob storage). Deploy is gated on a paid Railway plan + the R2 bucket.
- **Marketing / coming-soon site (`axona`, separate repo)** — a Next.js site configured to
  auto-deploy on Railway at `axonahq.com`; currently paused (expired trial), to be revived on upgrade.

## 7. What's next (not yet built)

- **GOLIVE.2b** — provision Postgres + Redis, set secrets, deploy web + worker, bind `app.axonahq.com`.
- **LEAD.1** — a public, hardened contact-sales lead-capture endpoint + in-app Leads view.
- **SITE.1** — a Sign-in button (→ the live app) and a contact-sales form on the coming-soon site.
- **PLM.13** — the BOM (as-designed) + revision-history screen.
- **GOLIVE.1 / GOLIVE.3** — transactional email (Resend) and billing (Stripe).
- **Sense / Predict / Act** — the upper north-star layers (seams already in place; not built).

## 8. Integrity & guardrails (non-negotiable, enforced)

- **No real company or person names** anywhere — seed, source, exports, docs — enforced by a CI
  scanner. Customer accounts render as anonymized OEM labels.
- **Humans approve money, safety, and contract actions.** Agents propose; a state machine gates.
- **Every agent action is auditable** — inputs, output, model, confidence, approver — to an immutable
  log.
- **Per-tenant isolation of data and models.** One tenant's data/models never leak into another's.
- **One git remote.** Product code is pushed only to its own repository; a non-overridable pre-push
  hook enforces it.
- **No invented traction or metrics** are ever shipped externally.

---

*Numbers in this document are repository build metrics as of the generation date. Sample data shown in
the app is illustrative and anonymized.*
