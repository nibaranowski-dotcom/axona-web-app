# Axona — Full Build Specification & Claude Code Boilerplate

> **Axona** is an **AI-native operating system for robotics companies** (always "operating system," never "ERP"). It covers the whole robot lifecycle — design, procure, build, test, sell, deliver, deploy, service — as a set of modules, each a vertical that owns its data, unified by a horizontal **Core** layer and a fleet of cooperating **agents**.
>
> This document is a complete handoff: product spec (every screen + its user stories), data model, agent architecture, API surface, and a runnable project skeleton. Hand it to Claude Code to scaffold the backend + frontend.

---

## 0. How to read this with Claude Code

1. Start from **§9 Project skeleton** — scaffold the monorepo and install deps.
2. Build the **data model (§3)** as Prisma schema + migrations; seed with §3.7.
3. Stand up the **API (§6)** and **agent runtime (§5)**.
4. Build the **frontend shell (§7)** then screens in §4 order (Core layer first).
5. Each screen in §4 lists **Purpose → Data → User stories → Key components → Agents** — implement in that order.

Brand invariants (do not drift): Archivo (UI/display) + JetBrains Mono (data/labels); paper `#ffffff`, panel `#f4f3ef`, ink `#0a0a0a`; single lime accent `#c6f24f`; functional green `#1f9e6f` for live/approved (no invented reds — critical states use ink); hairlines over shadows; dotted-grid motif; **no emoji**.

---

## 1. Product overview

- **Core layer (horizontal):** Command Center, Mission Control (launcher), Search, Agents, Workflows, Projects, Machines.
- **Value chain:** Procurement, Manufacturing, Inventory, Fulfillment, Quality, Sales & CRM, Marketing.
- **Robotics-specific:** Fleet, Field Service, Engineering & PLM, Autonomy.
- **Back office:** Finance, People, Security, Legal.
- **Multi-agent system:** every module runs ~6 specialized agents under a module orchestrator; a general **Axona agent** reads across modules. Agents draft, monitor, and act; humans approve. This is the product's moat.
- **Cross-module narrative** (use as seed data — it makes demos coherent): a SERVO-204 actuator drive runs stiff → Quality SPC flags torque over UCL → **NCR-118** opened → root-caused to **lot 88421** → **ECO-318** supersedes the drive with -205 → firmware v4.2.2 torque-comp → affects the **BMW** 24-unit order → ripples into Procurement (re-source), Fulfillment (Osaka customs hold), Field Service (battery-cert dispatch), Fleet/Autonomy (policy canary), Finance (margin −2.1pt), Legal (SLA + export), People (cert expiry).

---

## 2. Tech stack

**Monorepo** (pnpm workspaces + Turborepo)

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript everywhere | strict |
| Frontend | Next.js 14 (App Router) + React 18 | server components for data, client for interactivity |
| Styling | Tailwind + CSS variables = the design tokens | tokens map 1:1 to `tokens/*.css` |
| UI state | TanStack Query (server state) + Zustand (UI state) | |
| Charts | visx or lightweight SVG (SPC, funnels, trends) | keep it inline-style-able |
| Backend | Node + Fastify (REST + SSE) OR Next route handlers | SSE for agent traces |
| ORM/DB | Prisma + PostgreSQL | one schema, multi-tenant by `orgId` |
| Realtime | SSE for agent run streams; WebSocket optional for telemetry | |
| Queue/agents | BullMQ (Redis) for agent jobs + workflow runs | |
| Auth | Auth.js (NextAuth) — email/SSO; RBAC by role | |
| Vector/search | pgvector for file/chat semantic search; Postgres FTS for the command palette | |
| LLM | Claude (Anthropic API) via a thin `AgentRuntime` wrapper | tool-use loop |
| Files | S3-compatible blob store; text extraction pipeline | |
| Telemetry ingest | time-series table (or Timescale) for fleet + machine signals | |
| Infra | Docker Compose for dev; Postgres + Redis + MinIO | |

---

## 3. Data model (Prisma)

### 3.1 Core / tenancy
```prisma
model Org      { id String @id @default(cuid()); name String; users User[]; createdAt DateTime @default(now()) }
model User     { id String @id @default(cuid()); orgId String; org Org @relation(fields:[orgId],references:[id]); name String; email String @unique; role Role; createdAt DateTime @default(now()) }
enum Role      { ADMIN OPS ENGINEER SALES FINANCE TECH VIEWER }
model Module   { id String @id; key String @unique; name String; group ModuleGroup; orderIndex Int }
enum ModuleGroup { CORE VALUE_CHAIN ROBOTICS BACK_OFFICE }
```

### 3.2 Agents, chats, workflows
```prisma
model Agent {
  id String @id @default(cuid())
  orgId String
  moduleKey String          // owning module, or "core"
  name String               // "Sourcing agent"
  code String               // "proc-04"
  role String               // "SOURCING"
  description String        // one-liner: what it does
  state AgentState @default(LIVE)
  runs AgentRun[]
}
enum AgentState { LIVE WORKING CRITICAL OFFLINE }

model Chat    { id String @id @default(cuid()); orgId String; agentId String?; userId String; scope String; createdAt DateTime @default(now()); messages Message[] }
model Message { id String @id @default(cuid()); chatId String; role MsgRole; text String; citations Json?; createdAt DateTime @default(now()) }
enum MsgRole  { USER AGENT SYSTEM }

model Workflow {
  id String @id @default(cuid())
  orgId String
  moduleKey String
  name String
  description String
  status WorkflowStatus @default(DRAFT)
  trigger Json            // event spec
  steps Json             // ordered nodes: agent steps, decision gates, output
  runs WorkflowRun[]
}
enum WorkflowStatus { DRAFT ACTIVE PAUSED }
model WorkflowRun { id String @id @default(cuid()); workflowId String; status RunStatus; trace Json; startedAt DateTime @default(now()); endedAt DateTime? }
enum RunStatus { RUNNING SUCCEEDED FAILED }

model AgentRun { id String @id @default(cuid()); agentId String; input Json; trace Json; status RunStatus; createdAt DateTime @default(now()) }
```

### 3.3 Projects & files (Hebbia-style matrix)
```prisma
model Project { id String @id @default(cuid()); orgId String; moduleKey String; name String; description String; status ProjectStatus; members Json; files File[]; updatedAt DateTime @updatedAt }
enum ProjectStatus { ACTIVE IN_REVIEW BLOCKED DONE }
model File {
  id String @id @default(cuid())
  projectId String
  name String; ext String; sizeBytes Int; blobKey String
  type String              // Change, Spec, Quote, Report, Data, Memo, Plan…
  linkedTo String?         // e.g. "Engineering · SERVO-205"
  extracted Json           // AI-extracted column values keyed by columnId
  embedding Unsupported("vector")?  // pgvector
  modifiedAt DateTime @updatedAt
}
model MatrixColumn { id String @id @default(cuid()); projectId String; question String; createdBy String; createdAt DateTime @default(now()) }
// answers live in File.extracted[columnId]
```

### 3.4 Machines (own plant + mobile units)
```prisma
model Machine {
  id String @id @default(cuid())
  orgId String
  assetId String           // "CNC-02"
  name String
  kind MachineKind         // FIXED | MOBILE
  category String          // CNC, SMT, test-rig, AMR, forklift, demo-unit…
  location String
  status MachineStatus
  utilization Int          // 0-100
  health String            // "Healthy", "Re-cal overdue"…
  healthLevel HealthLevel
  telemetryOnline Boolean
  signals MachineSignal[]
}
enum MachineKind { FIXED MOBILE }
enum MachineStatus { RUNNING IDLE MAINTENANCE CHARGING FAULT }
enum HealthLevel { OK WATCH BAD }
model MachineSignal { id String @id @default(cuid()); machineId String; ts DateTime; metric String; value Float }
```

### 3.5 Value-chain entities
```prisma
model Supplier      { id String @id @default(cuid()); orgId String; name String; tier Int; riskScore Float; onTimePct Float }
model Part          { id String @id @default(cuid()); orgId String; sku String; name String; onHand Int; reorderPoint Int; leadDays Int }
model PurchaseOrder { id String @id @default(cuid()); orgId String; code String; supplierId String; partId String; qty Int; value Float; status POStatus; draftedByAgentId String?; eta DateTime? }
enum POStatus       { DRAFTED AWAITING_APPROVAL APPROVED SENT RECEIVED }
model WorkOrderMfg  { id String @id @default(cuid()); orgId String; serial String; product String; station String; status String; startedAt DateTime? }   // build genealogy per serial
model NCR           { id String @id @default(cuid()); orgId String; code String; defect String; linkedTo String; severity Severity; status String }
enum Severity       { MINOR MAJOR CRITICAL }
model SpcSample     { id String @id @default(cuid()); orgId String; characteristic String; serial String; value Float; ucl Float; lcl Float; mean Float; ts DateTime }
model Cert          { id String @id @default(cuid()); orgId String; name String; scope String; validTo DateTime; status String }
model Deal          { id String @id @default(cuid()); orgId String; account String; config String; value Float; stage DealStage; closeDate DateTime?; feasibility Feasibility }
enum DealStage      { QUALIFY DEMO PROPOSAL NEGOTIATION COMMIT }
enum Feasibility    { ON_TIME AT_RISK NOT_CHECKED }
model Campaign      { id String @id @default(cuid()); orgId String; name String; channel String; mqls Int; pipeline Float; roi Float; status String }
model Delivery      { id String @id @default(cuid()); orgId String; code String; account String; destination String; units String; stage DeliveryStage; committedDate DateTime; etaDate DateTime; riskState String }
enum DeliveryStage  { ALLOC CRATE FREIGHT CUSTOMS ONSITE COMMISSION ACTIVE }
```

### 3.6 Robotics + back office
```prisma
model Robot         { id String @id @default(cuid()); orgId String; serial String; model String; customer String; site String; uptimePct Float; firmware String; status String; lat Float?; lng Float? }
model TelemetryPoint{ id String @id @default(cuid()); robotId String; ts DateTime; metric String; value Float }
model WorkOrderField{ id String @id @default(cuid()); orgId String; code String; robotSerial String; site String; issue String; slaDueAt DateTime?; techId String?; status String; severity Severity }
model Technician    { id String @id @default(cuid()); orgId String; name String; initials String; site String; status String; certs Json }   // cert matrix: {certKey: {state, expiresAt}}
model ECO           { id String @id @default(cuid()); orgId String; code String; title String; changeType String; affected String; stage String }  // DRAFT/REVIEW/APPROVED/RELEASED
model FirmwareRelease{id String @id @default(cuid()); orgId String; version String; note String; state String }
model CompatCell    { id String @id @default(cuid()); orgId String; hwRev String; fwVersion String; state String }   // cert/compatible/in-test/na
model AutonomyMetric{ id String @id @default(cuid()); orgId String; site String; ts DateTime; autonomyRate Float; takeoversPer1k Float; policyVersion String }
model SafetyIncident{ id String @id @default(cuid()); orgId String; code String; type String; robotSerial String; site String; severity Severity; status String }
model PolicyVersion { id String @id @default(cuid()); orgId String; version String; note String; state String }     // current/canary/standby
model LedgerEntry   { id String @id @default(cuid()); orgId String; period String; account String; amount Float; kind String }
model Invoice       { id String @id @default(cuid()); orgId String; code String; account String; source String; amount Float; terms String; dueDate DateTime?; status String }
model UnitEconomic  { id String @id @default(cuid()); orgId String; product String; asp Float; cogs Float; marginPct Float; trend String }
model Requisition   { id String @id @default(cuid()); orgId String; role String; filled Int; target Int }
model CVE           { id String @id @default(cuid()); orgId String; code String; severity Severity; affectedUnits Int; status String }
model Obligation    { id String @id @default(cuid()); orgId String; account String; obligation String; actual String; state String }   // SLA tracked vs live ops
model ExportLicense { id String @id @default(cuid()); orgId String; destination String; code String; state String }
model LegalMatter   { id String @id @default(cuid()); orgId String; type String; title String; linkedTo String; status String }
```

### 3.7 Seed data
Seed the cross-module narrative end to end: NCR-118, ECO-318, SERVO-204/-205, lot 88421, BMW 24-unit deal (DLV-3312 Osaka customs hold), the p-13 autonomy canary on Site-3, M. Osei's expiring HV/battery cert, the HX-2 margin −2.1pt, etc. ~6 agents per module with real `code`/`role`/`description`. 14 projects across modules. 21 machines (8 fixed, 6+ mobile).

---

## 4. Screens (with user stories)

> Format per screen: **Purpose · Data · Stories · Components · Agents.** Build Core layer first.
> Every screen shares the **app shell**: left sidebar (wordmark, ⌘K search, collapsible nav sections CORE / VALUE CHAIN / ROBOTICS / BACK OFFICE), optional right **agent pane** (resizable, collapsible to a rail), and a dark **agent-trace** console on module screens.

### CORE LAYER

#### 4.1 Mission Control (launcher) — `/` (post-login home)
- **Purpose:** Mac-launchpad-style app grid; the post-login landing.
- **Data:** Module list + per-module alert counts.
- **Stories:**
  - As any user, I see all apps grouped Core / Value chain / Robotics / Back office and launch any one.
  - As a user, I type in the search field (or ⌘K) and it opens the **Search** palette carrying my query.
- **Components:** dark launcher grid, app tiles with one-line descriptions, search field.
- **Agents:** none (entry surface).

#### 4.2 Search (command palette) — `/search`
- **Purpose:** Spotlight-style universal search/autocomplete.
- **Data:** unified index over Agents, Chats, Files, Modules, Workflows, Projects (Postgres FTS + pgvector).
- **Stories:**
  - As a user, as I type I get live, grouped results across all object types.
  - As a user, I filter by scope tab (All / Agents / Files / …) with live counts.
  - As a user, ↑↓ navigate, ↵ opens, Esc returns to Mission Control.
- **Components:** glassy dark field, scope tabs, grouped result rows with type icon + context + tag.
- **Agents:** optional semantic-rank agent.

#### 4.3 Command Center — `/core`
- **Purpose:** the only horizontal screen — a live snapshot across every module.
- **Data:** KPI rollups per module; cross-module alerts/exceptions.
- **Stories:**
  - As Head of Ops, I see one KPI tile per domain (open POs, units built, fleet uptime, cash, open quality issues…).
  - As Head of Ops, I see cross-module exceptions ("supplier delay threatens 3 builds", "robot #214 flagged") and click through.
  - As a user, I ask the global copilot anything across modules.
- **Components:** KPI grid, alert/exception feed, copilot entry.
- **Agents:** general Axona agent.

#### 4.4 Agents — `/agents`
- **Purpose:** roster of every module's agents in one place.
- **Data:** all Agents, grouped by module.
- **Stories:**
  - As a user, I browse all agents grouped by module, each card showing a one-line description of what it does.
  - As a user, I open any agent into a chat and co-work.
  - As a user, I filter to "needs attention" (CRITICAL state).
- **Components:** module-grouped agent cards (dot-ring glyph + status dot + description), chat panel.
- **Agents:** all.

#### 4.5 Workflows (list) — `/workflows`
- **Purpose:** library of cross-module agent-orchestration workflows, grouped by module.
- **Data:** Workflows + last run summary.
- **Stories:**
  - As an ops lead, I browse workflows per module with a mini agent-chain preview, step/module counts, status, last run.
  - As an ops lead, I see which are Draft vs Active and open one.
  - As an ops lead, I ask the Axona agent for a run summary / which run most / to prep drafts.
- **Components:** module-separated workflow rows, agent-chain glyph row, side Axona agent.

#### 4.6 Workflow (detail) — `/workflows/:id`
- **Purpose:** author + run one workflow (Legora/Langdock style).
- **Data:** one Workflow (trigger, steps, gates) + live WorkflowRun trace.
- **Stories:**
  - As an ops lead, I see the canvas: trigger → agent steps (with module tags + glyphs) → decision gates/branches → output.
  - As an ops lead, I press **Run** and watch the run console stream the orchestration trace, lighting up each node.
  - As an ops lead, I use the "← All workflows" breadcrumb to switch.
- **Components:** step-flow canvas, decision gates, live run console (collapsible).

#### 4.7 Projects (list) — `/projects`
- **Purpose:** workspaces grouped per module (module = horizontal separator).
- **Data:** Projects + file counts + members.
- **Stories:**
  - As a contributor, I see projects under their owning module with description, file count, agent+human members, status, last activity.
  - As a contributor, I open a project into its file matrix.
  - As a lead, I ask the Axona agent for portfolio status / what's blocked.
- **Components:** module-separated project rows, member avatars, side Axona agent (collapsible).

#### 4.8 Project Files (matrix) — `/projects/:id`
- **Purpose:** Hebbia/Legora file matrix with AI-extracted columns.
- **Data:** Files in project + MatrixColumns + extracted values.
- **Stories:**
  - As an analyst, I see every file as a row with AI-extracted columns (e.g. "Cost / spec impact", "Agent flag").
  - As an analyst, I type a question in the "ask across all documents" bar and it becomes a new column answered per file.
  - As an analyst, I chat a side agent scoped to just these files, or the general Axona agent across modules — both cite the source files.
  - As a user, I collapse the agent pane.
- **Components:** sticky-header data table with extracted columns, ask-across-files bar (matrix), citation-aware side agent (collapsible).

#### 4.9 Machines — `/machines`
- **Purpose:** the company's own plant & equipment register (distinct from Fleet, which is deployed customer robots).
- **Data:** Machines (fixed + mobile) + MachineSignals.
- **Stories:**
  - As a plant manager, I see Fixed plant and Mobile units grouped, each with location, status, utilization, predictive-maintenance health, telemetry connectivity.
  - As a plant manager, the Machines agent flags what needs service and proposes a maintenance window.
  - As a plant manager, I filter to "needs service."
- **Components:** module-separated machine table, status/util/health/telemetry cells, side maintenance agent.

### VALUE CHAIN

#### 4.10 Procurement — `/procurement`
- **Purpose:** sourcing → PO lifecycle, agent-drafted.
- **Data:** Suppliers, Parts, PurchaseOrders.
- **Stories:** As a buyer, I review the PO queue (agent-drafted vs sent); approve/edit a drafted PO; see the agent reorder recommendation for a part below reorder point; chat the sourcing/negotiation/supply-risk agents.
- **Components:** PO queue table, agent recommendation banner, filter chips, agent-trace.
- **Agents:** sourcing, RFQ, negotiation, reorder, reconciliation, supply-risk.

#### 4.11 Manufacturing — `/manufacturing`
- **Purpose:** line execution (MES) + build genealogy.
- **Stories:** As a production lead, I watch the line flow, see throughput/OEE, trace a robot serial's full build history, get bottleneck alerts.
- **Agents:** scheduler, work-order, genealogy, OEE, kitting, PM.

#### 4.11b Inventory — `/inventory` *(stub — not yet designed; complete the set)*
- **Purpose:** parts/sub-assembly/finished-unit stock, reorder points, RMA, edge-cache spares.
- **Stories:** stock by location, reorder triggers feeding Procurement, RMA processing, reserve-against-order.
- **Agents:** stock, reorder, RMA, cycle-count, reservation, edge-cache.

#### 4.12 Fulfillment & Delivery — `/fulfillment`
- **Purpose:** delivery-as-a-project after QC.
- **Data:** Deliveries (stage timeline).
- **Stories:** As a fulfillment lead, I track each delivery across Alloc→Crate→Freight→Customs→On-site→Commission→Active vs its committed date; see the Osaka EAR99 customs hold; view shipment + commissioning panels.
- **Agents:** allocation, freight, customs, install-scheduling, commissioning, delivery-SLA.

#### 4.13 Quality & Testing — `/quality`
- **Purpose:** measurement-vs-spec + defect containment.
- **Data:** SpcSample, NCR, Cert.
- **Stories:** As a QA lead, I watch the SPC control chart (torque vs UCL/LCL) and see out-of-spec points; review the defect Pareto; open/track NCRs (NCR-118 critical → lot 88421); confirm CE/UL/ISO are audit-ready.
- **Agents:** inspection, SPC, root-cause, NCR/CAPA, calibration, compliance.

#### 4.14 Sales & CRM — `/sales`
- **Purpose:** enterprise capital-equipment selling with ops feasibility.
- **Data:** Deals.
- **Stories:** As an AE, I work the pipeline funnel + Q3 forecast; each deal shows an agent-checked **deliverability** badge (can ops build+deliver by the date — BMW flagged at-risk +3w); CPQ configures complex SKUs.
- **Agents:** lead-qualification, CPQ, feasibility, forecast, contract, renewal.

#### 4.15 Marketing — `/marketing`
- **Purpose:** demand-gen feeding Sales.
- **Stories:** As a marketer, I see the demand funnel + pipeline-by-channel attribution (events dominant) + campaigns; the underperforming paid campaign is flagged; agents reallocate budget and hand SQLs to Sales.
- **Agents:** campaign, content, ABM, lead-nurture, attribution, events.

### ROBOTICS

#### 4.16 Fleet — `/fleet`
- **Purpose:** deployed robots as live assets.
- **Data:** Robot, TelemetryPoint.
- **Stories:** As a fleet ops manager, I see units on a map with uptime/telemetry, OTA firmware versions, and predictive failure alerts (SN-2196 thermal) that hand off to Field Service.
- **Agents:** telemetry, predictive-maintenance, uptime-SLA, OTA, anomaly, energy.

#### 4.17 Field Service — `/field-service`
- **Purpose:** triage → dispatch → beat the SLA clock.
- **Data:** WorkOrderField, Technician.
- **Stories:** As a dispatcher, I use the technician dispatch board (today's schedule per tech) and the work-order queue with live SLA countdowns; the agent routes the right certified tech with the right part (continues the SN-2196 battery swap).
- **Agents:** dispatch, triage, parts, scheduling, knowledge, PM.

#### 4.18 Engineering & PLM — `/engineering`
- **Purpose:** product definition + change control.
- **Data:** ECO, FirmwareRelease, CompatCell.
- **Stories:** As an engineer, I move ECOs through Draft→Review→Approved→Released (ECO-318 from NCR-118); read the HW↔firmware compatibility matrix; manage firmware releases (v4.2.2-rc awaiting HX-1 cert before Fleet OTA).
- **Agents:** change, compatibility, firmware-release, impact, requirements, CAD/config.

#### 4.19 Autonomy (Robotics Ops) — `/autonomy`
- **Purpose:** do the robots do their jobs well & safely.
- **Data:** AutonomyMetric, SafetyIncident, PolicyVersion.
- **Stories:** As an autonomy lead, I watch the autonomy-rate trend (Site-3 regression after the p-13 canary), review safety incidents (INC-201 near-miss), and manage policy versions/rollback; sim validates a fix before promotion.
- **Agents:** mission, intervention, safety, policy, simulation, SLA.

### BACK OFFICE

#### 4.20 Finance — `/finance`
- **Purpose:** two revenue engines on one P&L.
- **Data:** LedgerEntry, Invoice, UnitEconomic.
- **Stories:** As a controller, I see recognized revenue split into lumpy hardware (at commissioning) vs ratable RaaS; per-unit economics (HX-2 margin −2.1pt from ECO-318); cash/runway; AR aging (BMW net-60, overdue Kawasaki).
- **Agents:** revenue-recognition, unit-economics, collections, payables, FP&A, close.

#### 4.21 People — `/people`
- **Purpose:** certification & competency management.
- **Data:** Technician (cert matrix), Requisition.
- **Stories:** As an ops/HR lead, I see the field-tech certification matrix where cert expiry gates dispatch (M. Osei's HV/battery cert expires in 12d — he's on the SN-2196 job); field-team-vs-fleet growth; headcount by function.
- **Agents:** certification, recruiting, onboarding, workforce-planning, skills, scheduling.

#### 4.22 Security — `/security`
- **Purpose:** the connected-robot attack surface.
- **Data:** CVE, Machine/Robot posture.
- **Stories:** As a security lead, I triage CVEs affecting deployed units, track device posture, manage access, and coordinate signed-firmware patch rollouts (with Engineering's cert gate).
- **Agents:** CVE-triage, posture, access, patch, anomaly-traffic, audit.

#### 4.23 Legal — `/legal`
- **Purpose:** contract obligations vs live ops, export control, liability.
- **Data:** Obligation, ExportLicense, LegalMatter.
- **Stories:** As counsel, I track contract obligations against live ops (BMW 99.5% SLA at-risk from the autonomy regression), export licensing (DLV-3312 EAR99 holding the shipment — robots are dual-use), and liability/IP matters (INC-201, ECO-318 patent) linked to their source modules.
- **Agents:** obligations, contract, export-control, compliance, liability, IP.

---

## 5. Agent runtime & multi-agent architecture

- **AgentRuntime**: a tool-use loop over Claude. Each agent = `{ systemPrompt, tools[], scope }`. Tools are typed functions that read/write the data model (e.g. `draftPurchaseOrder`, `openNCR`, `routeTechnician`, `runSpcCheck`, `recognizeRevenue`).
- **Module orchestrator**: routes a module event to the right agent; agents can call other agents' tools (cross-module) via the orchestrator, producing the **agent trace**.
- **Workflow engine**: a Workflow is a DAG of `{trigger, steps[], gates[]}`. A `WorkflowRun` executes nodes through BullMQ, streaming each step to the client over **SSE** → the run console. Decision gates branch on agent output (e.g. "under $50k → auto-route; else escalate").
- **Traces**: every AgentRun/WorkflowRun persists a `trace` (timestamped lines: scan / correlate / draft / policy-check / result) — this is what the dark console renders.
- **General Axona agent**: scope = cross-module; has read tools across all modules + project files; always answers with citations.
- **Human-in-the-loop**: agents draft & recommend; state machine requires human approval for money/safety/contract actions (PO approve, ECO release, policy rollback, credit note).
- **Guardrails**: per-role tool permissions; spend/risk policy checks as explicit gate tools; full audit log.

---

## 6. API surface (REST + SSE)

```
GET  /api/modules
GET  /api/core/summary                  // Command Center rollups + exceptions
GET  /api/search?q=&scope=              // command palette (FTS + vector)
GET  /api/agents?module=
POST /api/agents/:id/chat               // -> SSE stream of agent reply + trace
GET  /api/workflows?module=
GET  /api/workflows/:id
POST /api/workflows/:id/run             // -> SSE stream of run trace
GET  /api/projects?module=
GET  /api/projects/:id/files
POST /api/projects/:id/columns          // ask-across-files -> new MatrixColumn, async extract per file
GET  /api/machines
# per-module resource routes:
GET/POST /api/procurement/pos ; /quality/ncrs ; /quality/spc ; /sales/deals ;
         /fulfillment/deliveries ; /fleet/robots ; /field/work-orders ;
         /engineering/ecos ; /autonomy/metrics ; /finance/invoices ;
         /people/technicians ; /security/cves ; /legal/obligations …
```
Conventions: all list endpoints are org-scoped + paginated; agent/workflow endpoints stream via SSE; mutations that need approval return `status: AWAITING_APPROVAL`.

---

## 7. Frontend structure

```
apps/web/
  app/
    (shell)/layout.tsx           // sidebar + nav sections + agent-pane slot
    page.tsx                     // Mission Control (launcher)
    search/page.tsx
    core/page.tsx                // Command Center
    agents/page.tsx
    workflows/page.tsx
    workflows/[id]/page.tsx
    projects/page.tsx
    projects/[id]/page.tsx       // file matrix
    machines/page.tsx
    procurement/page.tsx ... legal/page.tsx
  components/
    shell/{Sidebar,NavSection,AgentPane,AgentRail,TraceConsole}.tsx
    agents/{AgentGlyph,AgentCard,ChatThread,Suggestions}.tsx
    core/{KpiStrip,AlertFeed}.tsx
    data/{DataTable,StatusBadge,ProgressBar,Funnel,SpcChart,StageTimeline,CompatMatrix}.tsx
  lib/{api,query,tokens}.ts
  styles/tokens.css              // = design-system tokens
```
- **AgentGlyph**: static 12-dot ring (never animated); status dot color = state.
- **AgentPane**: resizable (drag), collapsible to a 52px rail; co-works beside the module screen.
- **TraceConsole**: dark block; renders SSE trace lines.
- Tokens drive Tailwind via CSS variables; reuse the bound design system's components.

---

## 8. Roles & permissions (RBAC)
- ADMIN (all), OPS (Core + value chain + robotics ops), ENGINEER (Engineering/Quality/Autonomy write), SALES (Sales/Marketing write), FINANCE (Finance/Legal write), TECH (Field Service/Machines write), VIEWER (read).
- Agent tool execution is filtered by the acting user's role; approval actions are role-gated.

---

## 9. Project skeleton (scaffold this)

```
axona/
  pnpm-workspace.yaml
  turbo.json
  docker-compose.yml            // postgres + redis + minio
  packages/
    db/                         // prisma schema, migrations, seed
    agents/                     // AgentRuntime, tools, orchestrator, workflow engine
    config/                     // tokens, shared TS config, eslint
  apps/
    web/                        // Next.js (see §7)
    api/                        // Fastify (or fold into web route handlers)
```

**Bootstrap commands**
```bash
pnpm dlx create-turbo@latest axona
cd axona && pnpm add -w prisma @prisma/client zod
# packages/db: prisma init --datasource-provider postgresql; paste §3 schema; pnpm prisma migrate dev; pnpm db:seed
# packages/agents: implement AgentRuntime (Claude tool-use loop), tool registry, orchestrator, BullMQ workflow worker
# apps/web: next + tailwind; paste tokens; build shell then screens in §4 order
docker compose up -d            # postgres, redis, minio
```

**Env**
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
ANTHROPIC_API_KEY=...
S3_ENDPOINT=... S3_BUCKET=axona-files
AUTH_SECRET=...
```

**Build order (milestones)**
1. DB + seed (§3) → 2. Shell + nav + Mission Control + Search (§4.1–4.2, §7) → 3. AgentRuntime + Agents screen + chat SSE (§5, §4.4) → 4. Command Center rollups (§4.3) → 5. Projects + file matrix + extraction (§4.7–4.8) → 6. Workflows list + detail + run engine (§4.5–4.6) → 7. Machines (§4.9) → 8. value-chain modules → 9. robotics modules → 10. back-office modules → 11. RBAC + audit + guardrails.

---

## 10. Design tokens (paste into `styles/tokens.css`)
```css
:root{
  --font-sans:"Archivo",system-ui,sans-serif;
  --font-mono:"JetBrains Mono",ui-monospace,monospace;
  --paper:#ffffff; --panel:#f4f3ef; --panel-2:#eceae3; --skeleton:#e6e4dc;
  --ink:#1b1b1f; --ink-strong:#0a0a0a; --ink-muted:#55555f; --ink-faint:#8a8a93;
  --line:#e7e5df; --line-strong:#cfccc3; --line-panel:#d8d5cc;
  --accent:#c6f24f; --accent-ink:#1b2a00; --success:#1f9e6f; --success-tint:#e3f3ec;
  --on-dark-mut:#b9b9c0; --on-dark-faint:#6a6a73;
  --r-pill:999px; --r-btn:8px; --r-card:14px;
}
```

---

### Appendix — file ↔ route map (current HTML prototypes → app routes)
Command Center `Command Center.dc.html` → `/core` · Mission Control `Mission Control.dc.html` → `/` · Search `Search.dc.html` → `/search` · Agents → `/agents` · Workflows / Workflow → `/workflows` `/workflows/:id` · Projects / Project Files → `/projects` `/projects/:id` · Machines → `/machines` · then one module HTML per value-chain / robotics / back-office route above.
