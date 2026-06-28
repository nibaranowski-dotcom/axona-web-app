# Axona Web App — Build Backlog (CPRD-ready)

Source of truth: `specs/axona-build-spec.md`. Brand/tokens: `design.md`. This backlog is the
ordered story list Joe consumes via the **CPRD** trigger. Build order follows spec §9 milestones.

## How to use this with Joe
Paste any row as:

```
CPRD "[position][Epic][Track][StoryID][Title][Priority][Size][Status][Effort][Dependencies]"
```

Example:
```
CPRD "31 E3 Platform ART.1 AgentRuntime — Claude tool-use loop with typed tool registry P0 L todo 5 Needs FND.11, FND.6"
```

Joe emits a full Cursor-ready PRD on the build-spec stack (below). `Effort` is in dev-days.
`Status` starts `todo`; flip to `wip`/`done` as you go.

---

## Stack decision — build spec wins (reflected against the AI-native operating system scope)

I compared Joe's generic defaults against the Axona build spec for **this** product — a multi-tenant,
agent-orchestrating operating system for robotics with per-unit genealogy, fleet/machine telemetry,
SSE agent traces, and human-gated money/safety/contract actions. The spec stack wins on every axis;
the generic defaults are a starting point, not a frozen contract (per Joe's Precedence rule). Verdict:

| Layer | Joe default | **Axona (chosen)** | Why the spec wins for this scope |
|---|---|---|---|
| ORM/DB | Drizzle + Supabase | **Prisma + PostgreSQL** | §3 data model is already authored as Prisma across 40+ models; rewriting to Drizzle is pure cost. pgvector + FTS + a telemetry table all live in one Postgres. |
| Auth | Clerk | **Auth.js (NextAuth) + RBAC** | Enterprise robotics buyers need SSO/SAML and self-hostability; 7-role RBAC (§8) is org-internal, not Clerk's org model. |
| Background jobs | Inngest | **BullMQ (Redis)** | Workflows are explicit DAGs with decision gates streaming SSE traces (§5); BullMQ gives that control and pairs with the Redis the runtime already needs. |
| AI | Vercel AI SDK | **Claude via thin `AgentRuntime`** | The moat is a tool-use loop with cross-module orchestration + persisted traces (§5). Keep `generateObject`+Zod **as a principle** for any structured agent output. |
| Telemetry | — | **Postgres/Timescale time-series** | Fleet + machine signals need a real time-series store (§3.4/§3.6); Supabase adds nothing here. |
| Files | — | **S3/MinIO + extraction pipeline** | File matrix (§4.8) needs blob storage + text extraction + embeddings. |
| Deploy | Vercel | Vercel/web + worker for BullMQ | Web on Vercel; the agent/workflow worker runs as a long-lived Node process (not serverless). |

**Kept from Joe (engineering principles, stack-agnostic):** `orgId` on every query; mutations only
through server actions / route handlers; `requireRole()` as line 1 of every mutating action; Zod
schemas for all structured AI output with try/catch per AI call; named queue steps + `Promise.allSettled`
fan-out + idempotent inserts; field-approval governance (`approved_by`/`approved_at`, agents see only
approved data); a verify script + `docs/manual-checks.md` entry + clean `tsc --noEmit` per story.

**Design tokens:** Joe's near-black/electric-teal defaults are **overridden** by `design.md` — Archivo +
JetBrains Mono, paper/panel/ink surfaces, single lime `#c6f24f` signal, functional green for live/approved,
hairlines over shadows, no emoji, no invented reds (critical = ink). Light field, **not** dark-mode-first.

**Billing scope note:** the **Finance module (E8 / FIN.\*)** is a *product feature* — the robotics
customer's own P&L, invoices, unit economics. The **Billing epic (E10 / BILL.\*)** is *Axona-as-SaaS*
billing the tenant for seats/usage. They are different surfaces and must not be conflated.

---

## Architecture: four layers over one spine (see `specs/architecture-learnings.md`)

The product is four layers over one spine. Only **L2 compounds** — it is the moat; the rest are
competitive necessities buildable by anyone with engineers. Resourcing and care follow that asymmetry.

| Layer | What it is | In this backlog |
|---|---|---|
| **L4 — Vertical editions** | Humanoid · Mobility · Healthcare packaging | GTM surface, post-MVP |
| **L3 — Domain apps** | Procurement, Quality, Maintenance, Delivery, … (the 24 modules) | **E5–E8** |
| **L2 — Intelligence spine** | Specialized models · operational memory · agent runtime · learning loop | **E3 + E13 (THE MOAT)** |
| **L1 — Foundation** | Connectors · ontology · per-unit genealogy · immutable event log · data plane | **E0 + E12** |

**Two build sequences, reconciled.** E0–E11 are screen-first (spec §9) so the prototype/demo is
coherent fast. The *moat* sequence (learnings §11) is capture → memory → runtime+guardrails →
procurement wedge → **close the learning loop**. The reconciliation, and the single most important
engineering instruction in this repo:

> **Build the load-bearing capture in its correct shape from day one — even while the learning loop
> is stubbed.** Per-unit genealogy must be captured *as-built* (not reconstructed), telemetry is a
> first-class typed input (not an afterthought), and every agent action logs *model · confidence ·
> approver* into an immutable event log. Capture fidelity at L1 caps model quality at L2; retrofitting
> it later is the top risk (§12) and silently kills the moat. So `MFG.1` (genealogy), `FLEET.1`/`MACH.1`
> (telemetry), `AUDIT.1` (event log), and `ART.5` (trace) are **moat-load-bearing** — hold them to a
> higher bar than their P-level implies, and shape them per E12/E13/E14 even before those epics land.

**Feeds-the-loop test.** Score every new story on whether it feeds `data → memory → models → better
proposals → outcomes → data`. If it doesn't touch the loop, it's table stakes, not moat — fine to
build, but don't let it crowd out spine work.

**Wedge.** Procurement (`PROC.*`) is the first domain co-pilot — warmest access, most painful job
(long-lead sourcing + BOM churn + genealogy). Treat it as the proving ground for the spine, not just
another module.

---

## Epic map & build order

| Epic | Track | Theme | Spec ref |
|---|---|---|---|
| E0 | Foundation | Monorepo, tokens, data model, seed, shell, design-system primitives | §2, §3, §7, §9, §10 |
| E1 | Platform | Auth, signup/login, SSO, onboarding, org provisioning | §8 (+ gap) |
| E2 | Platform | RBAC, audit, approval state machine, guardrails | §5, §8 |
| E3 | Platform | Agent runtime, orchestrator, workflow engine, general Axona agent | §5 |
| E4 | Platform | Search/FTS+vector, file blob store, extraction pipeline | §3.3, §6 |
| E5 | Core | Mission Control, Search, Command Center, Agents, Workflows, Projects, Machines | §4.1–4.9 |
| E6 | Value Chain | Procurement, Manufacturing, Inventory, Fulfillment, Quality, Sales, Marketing | §4.10–4.15 |
| E7 | Robotics | Fleet, Field Service, Engineering & PLM, Autonomy | §4.16–4.19 |
| E8 | Back Office | Finance, People, Security, Legal | §4.20–4.23 |
| E9 | Platform | Org settings, member/role admin, user settings | gap |
| E10 | Platform | Billing & subscription (Stripe, seats, entitlements) | gap |
| E11 | Platform | Notifications & transactional email | gap |
| E12 | Moat · L1 | Foundation & ontology — connectors, ontology, genealogy, immutable event log | learnings §3–4 |
| E13 | Moat · L2 | Intelligence spine — operational memory, confidence, trust ladder, learning loop, SLMs | learnings §5–7 |
| E14 | Moat · Gov | Governance, per-tenant isolation, VPC/own-your-model deployment | learnings §8 |

---

## E0 — Foundation & Platform · Track: Foundation

| Pos | StoryID | Title | Pri | Size | Effort | Deps | Status |
|---|---|---|---|---|---|---|---|
| 1 | FND.1 | Scaffold pnpm + Turborepo monorepo (apps/web, apps/worker, packages/db, packages/agents, packages/config) | P0 | M | 3 | — | todo |
| 2 | FND.2 | Wire design tokens → Tailwind CSS variables from design.md; self-host Archivo + JetBrains Mono via next/font | P0 | S | 2 | FND.1 | todo |
| 3 | FND.3 | docker-compose dev env: Postgres + pgvector, Redis, MinIO | P0 | S | 1 | FND.1 | todo |
| 4 | FND.4 | CI + hooks: tsc --noEmit, eslint/prettier, block push-to-main, verify-script runner | P0 | S | 2 | FND.1 | todo |
| 5 | FND.5 | Prisma schema — Core/tenancy (Org, User, Role, Module, ModuleGroup) | P0 | S | 1 | FND.1 | todo |
| 6 | FND.6 | Prisma schema — Agents/Chats/Workflows/Runs (§3.2) | P0 | M | 3 | FND.5 | todo |
| 7 | FND.7 | Prisma schema — Projects/Files/MatrixColumn + pgvector embedding (§3.3) | P0 | S | 2 | FND.5 | todo |
| 8 | FND.8 | Prisma schema — Machines + MachineSignal time-series (§3.4) | P0 | S | 2 | FND.5 | todo |
| 9 | FND.9 | Prisma schema — Value-chain entities (§3.5) | P0 | M | 3 | FND.5 | todo |
| 10 | FND.10 | Prisma schema — Robotics + back-office entities (§3.6) | P0 | M | 3 | FND.5 | todo |
| 11 | FND.11 | Migrations + `packages/db` client (org-scoped query helpers, pagination) | P0 | M | 3 | FND.5-10 | todo |
| 12 | FND.12 | Seed the full cross-module narrative (NCR-118 → ECO-318 → SERVO-205, BMW DLV-3312, p-13 canary, Osei cert, HX-2 margin; ~6 agents/module, 14 projects, 21 machines) | P0 | L | 5 | FND.11 | todo |
| 13 | FND.13 | App shell: sidebar (wordmark, ⌘K, CORE/VALUE CHAIN/ROBOTICS/BACK OFFICE nav), resizable+collapsible agent pane, trace-console slot | P0 | L | 5 | FND.2 | todo |
| 14 | FND.14 | Data-component library: DataTable, StatusBadge, ProgressBar, Funnel, SpcChart, StageTimeline, CompatMatrix | P0 | L | 5 | FND.2 | todo |
| 15 | FND.15 | Agent primitives: AgentGlyph (static 12-dot ring), AgentCard, ChatThread, Suggestions | P0 | M | 3 | FND.2 | todo |

## E1 — Auth, Onboarding & Identity · Track: Platform

| Pos | StoryID | Title | Pri | Size | Effort | Deps | Status |
|---|---|---|---|---|---|---|---|
| 16 | AUTH.1 | Auth.js email/password + session + protected-route middleware | P0 | M | 3 | FND.11 | todo |
| 17 | AUTH.2 | Enterprise SSO/SAML + OIDC sign-in | P1 | M | 4 | AUTH.1 | todo |
| 18 | AUTH.3 | Post-auth routing — new user → onboarding, existing → Mission Control | P0 | S | 1 | AUTH.1 | todo |
| 19 | AUTH.4 | Signup + org provisioning (create Org, seat owner as ADMIN) | P0 | M | 3 | AUTH.1 | todo |
| 20 | AUTH.5 | Invite + accept-invite flow (email token → join org with role) | P0 | M | 3 | AUTH.4, EMAIL.1 | todo |
| 21 | AUTH.6 | Onboarding wizard: org profile, invite first members, enable modules | P1 | M | 3 | AUTH.4 | todo |
| 22 | AUTH.7 | Email verification + password reset | P0 | S | 2 | AUTH.1, EMAIL.1 | todo |

## E2 — RBAC, Audit & Guardrails · Track: Platform

| Pos | StoryID | Title | Pri | Size | Effort | Deps | Status |
|---|---|---|---|---|---|---|---|
| 23 | RBAC.1 | Role model + `requireRole()` guard (ADMIN/OPS/ENGINEER/SALES/FINANCE/TECH/VIEWER) | P0 | M | 3 | AUTH.1 | todo |
| 24 | RBAC.2 | Per-route authZ + org-scoping enforcement (every endpoint, server-validated) | P0 | M | 3 | RBAC.1 | todo |
| 25 | RBAC.3 | Agent tool-permission filter by acting user's role | P0 | M | 3 | RBAC.1, ART.2 | todo |
| 26 | RBAC.4 | Approval state machine for gated actions (PO approve, ECO release, policy rollback, credit note) → returns AWAITING_APPROVAL | P0 | M | 4 | RBAC.1 | todo |
| 27 | AUDIT.1 | Audit-log model + writer on every mutation & agent action | P0 | M | 3 | RBAC.2 | todo |
| 28 | AUDIT.2 | Audit-trail viewer (filter by actor/module/object) | P1 | S | 2 | AUDIT.1 | todo |

## E3 — Agent Runtime & Workflow Engine · Track: Platform

| Pos | StoryID | Title | Pri | Size | Effort | Deps | Status |
|---|---|---|---|---|---|---|---|
| 29 | ART.1 | AgentRuntime — Claude tool-use loop ({systemPrompt, tools[], scope}) | P0 | L | 5 | FND.11, FND.6 | todo |
| 30 | ART.2 | Typed tool registry over the data model (draftPurchaseOrder, openNCR, routeTechnician, runSpcCheck, recognizeRevenue…) with Zod I/O | P0 | L | 5 | ART.1 | todo |
| 31 | ART.3 | Module orchestrator — route events to agents; cross-module tool calls produce the agent trace | P0 | L | 5 | ART.2 | todo |
| 32 | ART.4 | Agent chat endpoint streaming reply + trace over SSE (`POST /api/agents/:id/chat`) | P0 | M | 4 | ART.1 | todo |
| 33 | ART.5 | AgentRun trace persistence + TraceConsole renderer (scan→correlate→draft→policy-check→result) | P0 | M | 3 | ART.1, FND.13 | todo |
| 34 | WF.1 | Workflow DAG model + BullMQ run engine (steps, gates, branches) | P0 | L | 5 | ART.3 | todo |
| 35 | WF.2 | WorkflowRun SSE stream + decision-gate evaluation (e.g. <$50k auto-route else escalate) | P0 | M | 4 | WF.1 | todo |
| 36 | WF.3 | Guardrail gate tools — spend/risk/policy checks as explicit DAG nodes | P0 | M | 3 | WF.1, RBAC.4 | todo |
| 37 | GA.1 | General Axona agent — cross-module read scope, always cites source files/objects | P0 | M | 4 | ART.3, SRCH.2 | todo |

## E4 — Search & Files Platform · Track: Platform

| Pos | StoryID | Title | Pri | Size | Effort | Deps | Status |
|---|---|---|---|---|---|---|---|
| 38 | SRCH.1 | Unified index — Postgres FTS + pgvector over Agents/Chats/Files/Modules/Workflows/Projects | P0 | M | 4 | FND.11 | todo |
| 39 | SRCH.2 | Search API (`/api/search?q=&scope=`) grouped results + live counts | P0 | M | 3 | SRCH.1 | todo |
| 40 | FILE.1 | S3/MinIO blob upload + File record lifecycle | P0 | M | 3 | FND.7 | todo |
| 41 | FILE.2 | Text-extraction + embedding pipeline (queue job) | P0 | M | 4 | FILE.1, SRCH.1 | todo |
| 42 | MTX.1 | Ask-across-files column extraction job (`POST /projects/:id/columns` → per-file answers) | P0 | M | 4 | FILE.2, ART.2 | todo |

## E5 — Core Layer Screens · Track: Core

| Pos | StoryID | Title | Pri | Size | Effort | Deps | Status |
|---|---|---|---|---|---|---|---|
| 43 | MC.1 | Mission Control launcher — module grid (Core/Value chain/Robotics/Back office) + per-module alert counts + ⌘K hand-off | P0 | M | 3 | FND.13 | todo |
| 44 | SRCH.3 | Search palette UI — scope tabs, grouped rows, ↑↓/↵/Esc keyboard nav | P0 | M | 3 | SRCH.2, MC.1 | todo |
| 45 | CMD.1 | Command Center rollups API (`/api/core/summary`) — per-module KPIs + cross-module exceptions | P0 | M | 4 | FND.11 | todo |
| 46 | CMD.2 | Command Center screen — KPI grid, alert/exception feed (click-through), global copilot entry | P0 | L | 5 | CMD.1, GA.1 | todo |
| 47 | AGT.1 | Agents roster screen — module-grouped cards (glyph + status dot + description), open into chat | P0 | M | 4 | ART.4, FND.15 | todo |
| 48 | AGT.2 | Agents "needs attention" filter (CRITICAL state) | P1 | XS | 1 | AGT.1 | todo |
| 49 | WFL.1 | Workflows list — module-separated rows, agent-chain glyph preview, step/module counts, status, last run | P0 | M | 3 | WF.1 | todo |
| 50 | WFL.2 | Workflow detail — step-flow canvas (trigger→agents→gates→output) + live run console + Run button | P0 | L | 5 | WFL.1, WF.2 | todo |
| 51 | PROJ.1 | Projects list — module-separated rows, file count, agent+human members, status, last activity, side Axona agent | P0 | M | 3 | FND.11, GA.1 | todo |
| 52 | MTX.2 | Project file matrix — sticky-header table with AI-extracted columns, ask-across-files bar, citation-aware side agent (collapsible) | P0 | L | 5 | PROJ.1, MTX.1 | todo |
| 53 | MACH.1 | Machines screen — Fixed/Mobile groups, status/util/health/telemetry cells, "needs service" filter, maintenance agent | P0 | M | 4 | FND.11, ART.4 | todo |

## E6 — Value Chain · Track: Value Chain

| Pos | StoryID | Title | Pri | Size | Effort | Deps | Status |
|---|---|---|---|---|---|---|---|
| 54 | PROC.1 | Procurement data/API — Suppliers, Parts, PurchaseOrders (org-scoped, paginated) | P0 | S | 2 | FND.11 | todo |
| 55 | PROC.2 | Procurement screen — PO queue (drafted vs sent), approve/edit drafted PO, reorder banner, filter chips, agent-trace | P0 | M | 4 | PROC.1, RBAC.4 | todo |
| 56 | PROC.3 | Procurement agents — sourcing, RFQ, negotiation, reorder, reconciliation, supply-risk | P0 | M | 4 | PROC.2, ART.2 | todo |
| 57 | MFG.1 | Manufacturing data/API — WorkOrderMfg + build genealogy per serial | P0 | S | 2 | FND.11 | todo |
| 58 | MFG.2 | Manufacturing screen — line flow, throughput/OEE, serial genealogy trace, bottleneck alerts | P0 | M | 4 | MFG.1 | todo |
| 59 | MFG.3 | Manufacturing agents — scheduler, work-order, genealogy, OEE, kitting, PM | P0 | M | 4 | MFG.2, ART.2 | todo |
| 60 | INV.1 | Inventory data/API — stock by location, reorder points, RMA, reservations, edge-cache spares | P0 | S | 2 | FND.11 | todo |
| 61 | INV.2 | Inventory screen — stock by location, reorder triggers feeding Procurement, RMA processing, reserve-against-order | P1 | M | 4 | INV.1, PROC.1 | todo |
| 62 | INV.3 | Inventory agents — stock, reorder, RMA, cycle-count, reservation, edge-cache | P1 | M | 3 | INV.2, ART.2 | todo |
| 63 | FUL.1 | Fulfillment data/API — Deliveries with stage timeline | P0 | S | 2 | FND.11 | todo |
| 64 | FUL.2 | Fulfillment screen — stage timeline (Alloc→Crate→Freight→Customs→On-site→Commission→Active) vs committed date, Osaka EAR99 hold, shipment + commissioning panels | P0 | M | 4 | FUL.1 | todo |
| 65 | FUL.3 | Fulfillment agents — allocation, freight, customs, install-scheduling, commissioning, delivery-SLA | P0 | M | 4 | FUL.2, ART.2 | todo |
| 66 | QUAL.1 | Quality data/API — SpcSample, NCR, Cert | P0 | S | 2 | FND.11 | todo |
| 67 | QUAL.2 | Quality screen — SPC control chart (torque vs UCL/LCL), defect Pareto, NCR tracker (NCR-118 → lot 88421), CE/UL/ISO audit status | P0 | L | 5 | QUAL.1, FND.14 | todo |
| 68 | QUAL.3 | Quality agents — inspection, SPC, root-cause, NCR/CAPA, calibration, compliance | P0 | M | 4 | QUAL.2, ART.2 | todo |
| 69 | SALES.1 | Sales data/API — Deals (stages, feasibility) | P0 | S | 2 | FND.11 | todo |
| 70 | SALES.2 | Sales screen — pipeline funnel + Q3 forecast, agent-checked deliverability badge (BMW at-risk +3w), CPQ configurator | P0 | L | 5 | SALES.1, FUL.1, MFG.1 | todo |
| 71 | SALES.3 | Sales agents — lead-qualification, CPQ, feasibility, forecast, contract, renewal | P0 | M | 4 | SALES.2, ART.2 | todo |
| 72 | MKT.1 | Marketing data/API — Campaigns | P1 | S | 2 | FND.11 | todo |
| 73 | MKT.2 | Marketing screen — demand funnel, pipeline-by-channel attribution (events dominant), campaign cards, underperforming-paid flag | P1 | M | 3 | MKT.1, SALES.1 | todo |
| 74 | MKT.3 | Marketing agents — campaign, content, ABM, lead-nurture, attribution, events | P1 | M | 3 | MKT.2, ART.2 | todo |

## E7 — Robotics · Track: Robotics

| Pos | StoryID | Title | Pri | Size | Effort | Deps | Status |
|---|---|---|---|---|---|---|---|
| 75 | FLEET.1 | Fleet data/API — Robot + TelemetryPoint ingest | P0 | M | 3 | FND.11 | todo |
| 76 | FLEET.2 | Fleet screen — units on map, uptime/telemetry, OTA firmware versions, predictive-failure alerts (SN-2196 thermal) → Field Service hand-off | P0 | L | 5 | FLEET.1, FND.14 | todo |
| 77 | FLEET.3 | Fleet agents — telemetry, predictive-maintenance, uptime-SLA, OTA, anomaly, energy | P0 | M | 4 | FLEET.2, ART.2 | todo |
| 78 | FIELD.1 | Field Service data/API — WorkOrderField, Technician | P0 | S | 2 | FND.11 | todo |
| 79 | FIELD.2 | Field Service screen — tech dispatch board, work-order queue with live SLA countdowns, agent routing (cert + part, SN-2196 battery swap) | P0 | L | 5 | FIELD.1, FLEET.1 | todo |
| 80 | FIELD.3 | Field Service agents — dispatch, triage, parts, scheduling, knowledge, PM | P0 | M | 4 | FIELD.2, ART.2 | todo |
| 81 | ENG.1 | Engineering data/API — ECO, FirmwareRelease, CompatCell | P0 | S | 2 | FND.11 | todo |
| 82 | ENG.2 | Engineering screen — ECO board (Draft→Review→Approved→Released; ECO-318 from NCR-118), HW↔firmware compat matrix, firmware releases (v4.2.2-rc cert gate) | P0 | L | 5 | ENG.1, FND.14, RBAC.4 | todo |
| 83 | ENG.3 | Engineering agents — change, compatibility, firmware-release, impact, requirements, CAD/config | P0 | M | 4 | ENG.2, ART.2 | todo |
| 84 | AUTO.1 | Autonomy data/API — AutonomyMetric, SafetyIncident, PolicyVersion | P0 | S | 2 | FND.11 | todo |
| 85 | AUTO.2 | Autonomy screen — autonomy-rate trend (Site-3 p-13 regression), safety incidents (INC-201), policy versions + rollback, sim-validate-before-promote | P0 | L | 5 | AUTO.1, RBAC.4 | todo |
| 86 | AUTO.3 | Autonomy agents — mission, intervention, safety, policy, simulation, SLA | P0 | M | 4 | AUTO.2, ART.2 | todo |

## E8 — Back Office · Track: Back Office

| Pos | StoryID | Title | Pri | Size | Effort | Deps | Status |
|---|---|---|---|---|---|---|---|
| 87 | FIN.1 | Finance data/API — LedgerEntry, Invoice, UnitEconomic | P0 | S | 2 | FND.11 | todo |
| 88 | FIN.2 | Finance screen — revenue split (lumpy hardware vs ratable RaaS), per-unit economics (HX-2 −2.1pt from ECO-318), cash/runway, AR aging (BMW net-60, overdue Kawasaki) | P0 | L | 5 | FIN.1, FND.14 | todo |
| 89 | FIN.3 | Finance agents — revenue-recognition, unit-economics, collections, payables, FP&A, close | P0 | M | 4 | FIN.2, ART.2 | todo |
| 90 | PPL.1 | People data/API — Technician cert matrix, Requisition | P0 | S | 2 | FND.11 | todo |
| 91 | PPL.2 | People screen — field-tech certification matrix (cert expiry gates dispatch; Osei HV/battery −12d on SN-2196), field-team-vs-fleet growth, headcount by function | P0 | M | 4 | PPL.1, FIELD.1 | todo |
| 92 | PPL.3 | People agents — certification, recruiting, onboarding, workforce-planning, skills, scheduling | P1 | M | 3 | PPL.2, ART.2 | todo |
| 93 | SEC.1 | Security data/API — CVE + device posture | P0 | S | 2 | FND.11 | todo |
| 94 | SEC.2 | Security screen — CVE triage (affected deployed units), device posture, access mgmt, signed-firmware patch rollout (Engineering cert gate) | P0 | M | 4 | SEC.1, ENG.1 | todo |
| 95 | SEC.3 | Security agents — CVE-triage, posture, access, patch, anomaly-traffic, audit | P1 | M | 3 | SEC.2, ART.2 | todo |
| 96 | LEGAL.1 | Legal data/API — Obligation, ExportLicense, LegalMatter | P0 | S | 2 | FND.11 | todo |
| 97 | LEGAL.2 | Legal screen — obligations vs live ops (BMW 99.5% SLA at-risk), export licensing (DLV-3312 EAR99 hold), liability/IP matters (INC-201, ECO-318 patent) linked to source modules | P0 | M | 4 | LEGAL.1, AUTO.1, FUL.1 | todo |
| 98 | LEGAL.3 | Legal agents — obligations, contract, export-control, compliance, liability, IP | P1 | M | 3 | LEGAL.2, ART.2 | todo |

## E9 — Org & User Settings · Track: Platform

| Pos | StoryID | Title | Pri | Size | Effort | Deps | Status |
|---|---|---|---|---|---|---|---|
| 99 | SET.1 | Org settings — profile, branding, module enablement, defaults | P1 | M | 3 | AUTH.4, RBAC.2 | todo |
| 100 | SET.2 | Member & role administration — invite, change role, deactivate (ADMIN-gated) | P0 | M | 3 | RBAC.1, AUTH.5 | todo |
| 101 | SET.3 | User settings — profile, password, sessions/devices | P1 | S | 2 | AUTH.1 | todo |
| 102 | SET.4 | User notification preferences (channels + per-event opt-in) | P1 | S | 2 | NOTIF.1 | todo |
| 103 | SET.5 | Integrations & SSO config + API keys (encrypted at rest) | P2 | M | 3 | AUTH.2, RBAC.2 | todo |

## E10 — Billing & Subscription (Axona SaaS) · Track: Platform

| Pos | StoryID | Title | Pri | Size | Effort | Deps | Status |
|---|---|---|---|---|---|---|---|
| 104 | BILL.1 | Stripe integration — products/plans, customer per Org, webhook handling (idempotent) | P1 | M | 4 | AUTH.4 | todo |
| 105 | BILL.2 | Subscription + seat management (sync seats to active Users) | P1 | M | 3 | BILL.1, SET.2 | todo |
| 106 | BILL.3 | Billing settings screen — plan, payment method, invoice history | P1 | M | 3 | BILL.1 | todo |
| 107 | BILL.4 | Usage metering + entitlements/limits (agent runs, seats, modules) gating access | P2 | M | 4 | BILL.2, ART.5 | todo |
| 108 | BILL.5 | Trial / paywall / dunning states + grace handling | P2 | M | 3 | BILL.2, EMAIL.1 | todo |

## E11 — Notifications & Email · Track: Platform

| Pos | StoryID | Title | Pri | Size | Effort | Deps | Status |
|---|---|---|---|---|---|---|---|
| 109 | EMAIL.1 | Transactional email service (invites, verify, reset, receipts) — **Resend** + React Email templates; human-approved sends only | P0 | M | 3 | FND.1 | todo |
| 110 | NOTIF.1 | Notification model + in-app notification center | P1 | M | 3 | FND.11 | todo |
| 111 | NOTIF.2 | Wire agent/workflow approvals + cross-module exceptions into notifications | P0 | M | 3 | NOTIF.1, RBAC.4, ART.5 | todo |
| 112 | NOTIF.3 | Per-channel routing (in-app / email) honoring user preferences | P1 | S | 2 | NOTIF.2, EMAIL.1, SET.4 | todo |
| 113 | EMAIL.2 | Scheduled digest email (daily/weekly cross-module summary) | P2 | S | 2 | NOTIF.1, EMAIL.1 | todo |

## E12 — Foundation & Ontology (L1) · Track: Moat · L1

> Capture-fidelity layer. The prototype (E0) uses Prisma models directly; this epic hardens them into
> the robotics-native substrate — ontology + as-built genealogy + immutable event log — that L2 learns
> from. These are **moat-load-bearing**; build E0's `MFG.1`/`FLEET.1`/`MACH.1`/`AUDIT.1` already shaped
> toward them.

| Pos | StoryID | Title | Pri | Size | Effort | Deps | Status |
|---|---|---|---|---|---|---|---|
| 114 | ONT.1 | Ontology objects + immutable event log (Unit·Part·Serial·Firmware·BOM·PO/RFQ·Supplier·WorkOrder·Machine/fixture·Human·Agent) over Postgres+pgvector | P0 | L | 6 | FND.11 | todo |
| 115 | ONT.2 | Per-unit genealogy spine captured **as-built** (Unit→Parts/Serials/Firmware), not reconstructed; capture-fidelity guarantees | P0 | L | 5 | ONT.1, MFG.1 | todo |
| 116 | CONN.1 | Connector framework — pluggable ingest from ERP/PLM/MES, email, chat, machine telemetry; **speak MCP** as the tool/connector standard (Anthropic-native); use Arcade/Composio for authed external-SaaS connectors rather than hand-rolled OAuth | P1 | L | 6 | ONT.1 | todo |
| 117 | CONN.2 | Normalize step — entity resolution + dedupe + diff-against-last-state → event log | P1 | L | 5 | CONN.1, ONT.1 | todo |
| 118 | TEL.1 | Telemetry as first-class labeled input (fleet + plant) wired into event log + memory | P1 | M | 4 | ONT.1, FLEET.1, MACH.1 | todo |

## E13 — Intelligence Spine (L2 · THE MOAT) · Track: Moat · L2

> Research-grade portfolio (learnings §7), not a single "agent feature." Each line carries its own eval
> metric. `ART.*` (E3) is the runtime; this epic is the memory, confidence, trust, and learning loop
> that make it compound. LOOP/SLM are post-wedge bets — defensibility begins when LOOP.\* closes.

| Pos | StoryID | Title | Pri | Size | Effort | Deps | Status |
|---|---|---|---|---|---|---|---|
| 119 | MEM.1 | Operational memory store — structured graph + vector over decisions/exceptions/approvals/genealogy/telemetry (**not** RAG-over-PDFs). **Build — do not buy Mem0/Letta** (they'd hold the moat); study Zep/Graphiti's temporal-KG as a reference. pgvector now; watch Turbopuffer if multi-tenant scale/cost bites | P0 | L | 6 | ONT.1 | todo |
| 120 | MEM.2 | Context assembly + retrieval for operational decisions; feeds AgentRuntime context | P0 | L | 5 | MEM.1, ART.1 | todo |
| 121 | CONF.1 | Calibrated **confidence** as a first-class field on every proposal — logged, surfaced, gates autonomy | P0 | M | 4 | ART.1, AUDIT.1 | todo |
| 122 | TRUST.1 | Progressive-trust / autonomy ladder — per-agent scope widening, measured + surfaced as a product surface | P1 | L | 5 | CONF.1, RBAC.4 | todo |
| 123 | LOOP.1 | Outcome capture + reward modeling from **physical** outcomes (on-time / line-halt / pass-test) | P1 | L | 5 | ONT.1, MEM.1 | todo |
| 124 | LOOP.2 | Continuous-learning loop — production-trace → train/distill → serve (online RL / self-distillation; OpenPipe-style trace fine-tuning as a bootstrap; Modal/E2B-class or own-VPC GPUs for compute) | P2 | XL | 8 | LOOP.1, SLM.1 | todo |
| 125 | LOOP.3 | Reward-hack detection + eval harness (so the loop doesn't game itself) — build on the OBS.1 tracing/eval substrate; Patronus-style simulation for pre-promotion stress-tests | P1 | L | 5 | LOOP.1, OBS.1 | todo |
| 126 | SLM.1 | Specialized small models (BOM diff, supply-risk, genealogy QA) + frontier-fallback router (**adopt LiteLLM** — don't build the router); fine-tune from traces (OpenPipe/Fastino as accelerants); VPC-deployable | P2 | XL | 8 | MEM.2, ONT.2 | todo |

## E14 — Governance, Isolation & Deployment · Track: Moat · Gov

> Trust + deployment posture are **sales unlocks**, not compliance overhead (learnings §8). "Own your
> model" + VPC is a reason to choose Axona, especially in regulated verticals.

| Pos | StoryID | Title | Pri | Size | Effort | Deps | Status |
|---|---|---|---|---|---|---|---|
| 127 | GUARD.1 | `guardrails.config` as enforced data — never auto-place an order · never claim stock without a source · never invent a supplier or lead time | P0 | M | 4 | WF.3, RBAC.4 | todo |
| 128 | AUDIT.3 | Extend audit — every agent action records **model · confidence · approver** (makes propose→approve→audit literal) | P0 | S | 2 | AUDIT.1, CONF.1 | todo |
| 129 | ISO.1 | Per-tenant isolation of **data and models** — no cross-tenant leak; protects the config-not-rebuild transfer story | P0 | M | 4 | RBAC.2, MEM.1 | todo |
| 130 | DEPLOY.1 | VPC / on-prem deployment posture + own-your-model SLM packaging | P2 | L | 6 | ISO.1, SLM.1 | todo |
| 131 | PRIM.1 | Reusable-primitives inventory + recomposition-rate tracking (agents · memory · ontology · integrations · interfaces · SOPs) | P2 | M | 3 | ONT.1, MEM.1 | todo |

---

## Infra build-vs-buy (from `research/agentic-infra-landscape.md`)

The rule: **buy the plumbing, build the moat.** Only L2 (memory · models · learning loop) is built
in-house; everything undifferentiated is bought if it's cheaper than building.

- **Adopt now:** MCP (connector standard → CONN.1) · an observability/eval substrate, **Langfuse** self-host
  (→ new OBS.1) · **Resend** for transactional email (→ EMAIL.1).
- **Adopt when the trigger hits:** **LiteLLM** model-router when SLM+frontier lands (→ SLM.1) · Modal/E2B
  for SLM train/serve + sandboxed tool execution (→ LOOP.2) · Turbopuffer if pgvector scale bites (→ MEM.1).
- **Build — never outsource (it's the moat):** the runtime (ART.*), operational memory (MEM.1), the
  learning loop + SLMs (LOOP.*/SLM.1). Study Mem0/Zep/Letta + OpenPipe/Fastino as references, not vendors.
- **Watch:** Arcade/Composio (external-SaaS auth → CONN.1) · AgentMail + A2A Agent Cards (agent identity/email
  → new AGENTID.1) · Patronus simulation (→ LOOP.3 / AUTO.2). **Skip:** heavy agent frameworks, agent
  payment rails, Pinecone.

Two stories added from the research:

| Pos | StoryID | Title | Pri | Size | Effort | Deps | Status |
|---|---|---|---|---|---|---|---|
| 132 | OBS.1 | Agent tracing + eval substrate — adopt **Langfuse** (self-host/VPC); trace every AgentRun/WorkflowRun, power eval-driven dev + the LOOP.3 harness; complements (doesn't replace) the immutable audit log | P1 | M | 3 | ART.5 | todo |
| 133 | AGENTID.1 | Agent-facing email + identity (WATCH/later) — outward-facing agents get inboxes (**AgentMail**) + **A2A** signed Agent Cards for supplier/customer agent interop | P2 | M | 4 | CONN.1, ART.2 | todo |

---

## Totals & sequencing notes
- **133 stories** across 15 epics. P0 = MVP spine; P1 = complete the set; P2 = harden/monetize/research.
- **Moat layer (E12–E14)** is the part that keeps Axona *product, not services*. Build it in the
  learnings §11 order — L1 capture → memory → runtime+guardrails → procurement wedge → **close the loop**
  — and remember a plan that stops at "we shipped a procurement co-pilot" has built a feature, not the
  moat. Protect the runway to `LOOP.*`.
- **113 original stories** across 12 epics. P0 = MVP spine; P1 = complete the set; P2 = harden/monetize.
- Foundation (E0) and the agent runtime (E3) gate almost everything — build them first, exactly per
  spec §9 milestones (DB+seed → shell+Mission Control+Search → AgentRuntime+Agents+chat → Command
  Center → Projects/matrix → Workflows+engine → Machines → value-chain → robotics → back-office →
  RBAC+audit+guardrails). RBAC/audit (E2) is threaded early because every mutation needs it.
- Each module follows the same triad — **data/API → screen → agents** — so they parallelize across
  developers once E0–E4 land.
- `EMAIL.1` is pulled to P0 because AUTH.5/AUTH.7 depend on it.
- Every story's PRD (via CPRD) ships a verify script, a `docs/manual-checks.md` entry, agent trace
  where relevant, human-in-the-loop on gated actions, RBAC + org scoping, v2 tokens only, clean tsc.
