# Axona v2 — Build Handoff

AI-native **operating system for robotics companies** (never "ERP"). Light app shell, warm-grey panels, single lime accent, Archivo + JetBrains Mono. Every module is a vertical that owns its data; the Core layer reads horizontally across all of them. Multi-agent system throughout.

---

## App shell (shared across every screen)

- **Left sidebar** — `axona` wordmark + asymmetric square mark; a **Search bar** (⌘K) that opens Mission Control / the Search palette; collapsible nav sections (`<details>` with a light-grey chevron on the right).
- **Nav sections (with labels, like the domains doc):**
  - **CORE** — Command Center · Agents · Workflows · Projects · Machines
  - **VALUE CHAIN** — Procurement · Manufacturing · Inventory · Fulfillment · Quality · Sales & CRM · Marketing
  - **ROBOTICS** — Fleet · Field Service · Engineering · Autonomy
  - **BACK OFFICE** — Finance · People · Security · Legal
- **Right agent pane** — resizable (drag handle), collapsible to a slim rail (collapse button replaced the "Live" indicator). Center module screen + right agent pane co-work side by side.
- **Agent identity** — a **static 12-dot ring glyph** (NOT animated — a spinning/fading version read as a loading spinner and was rejected). Every agent is the same color; state shown by a small status dot (green = live, lime = working, ink = critical).
- **Agent trace** — a dark console block at the bottom of each module showing the orchestration steps.
- Nav items are real links; `[data-screen-label]` / breadcrumbs used for navigation.

---

## CORE layer screens

| Screen | File | What it does |
|---|---|---|
| **Command Center** | `Command Center.dc.html` | Horizontal overview across every module — KPI tiles per domain, cross-module alerts & exceptions, global copilot entry. (Was "Core" → renamed.) |
| **Mission Control** | `Mission Control.dc.html` | Mac-launchpad-style app grid (post-login), dark. Apps grouped Core / Value chain / Robotics / Back office. Search field (⌘K) → opens the Search palette carrying the query. |
| **Search** | `Search.dc.html` | Spotlight/command-palette (dark). Live autocomplete across **Agents, Chats, Files, Modules, Workflows, Projects**, grouped by type with scope tabs + counts; every row links out. Seeded from Mission Control's query via URL hash. |
| **Agents** | `Agents.dc.html` | Roster of every module's agents in one place; each card has a one-line description of what the agent does; opens a chat. |
| **Workflows** (list) | `Workflows.dc.html` | Per-module list of agent-orchestration workflows (module = horizontal separator), with a mini agent-chain glyph, step/module counts, status, last run. |
| **Workflow** (detail) | `Workflow.dc.html` | Full canvas view: trigger → agent steps → decision gates/branches → output, plus a live **run console** that streams the orchestration trace. (Legora/Langdock style.) |
| **Projects** (list) | `Projects.dc.html` | Workspaces grouped per module; rows show description, file count, agent+human members, status, last activity. Side Axona agent (All / Blocked scope). |
| **Project Files** | `Project Files.dc.html` | Hebbia/Legora-style file matrix: each file a row with AI-extracted columns + an "ask across all documents" bar that adds an answered column. Side agent toggles project-scoped vs general Axona agent; collapsible. |
| **Machines** | `Machines.dc.html` | The company's own plant & equipment register (distinct from Fleet). Fixed plant + Mobile units as separators; status, utilization, predictive-maintenance health, telemetry. Side maintenance agent. |

---

## Module screens (designed function-first, not generic)

Each was designed by first asking "what must this module do for a robotics company," then building the signature artifact. All share the shell + agent pane + trace, and reference a continuous cross-module story (SERVO-204 torque defect → NCR-118 → ECO-318 → BMW order → fleet/field/legal ripples).

- **Procurement** — PO queue; agents draft reorders (sourcing, RFQ, negotiation, reorder, reconciliation, supply-risk).
- **Manufacturing** — line-flow / MES, build genealogy per serial.
- **Fulfillment & Delivery** — **delivery pipeline** (Alloc→Crate→Freight→Customs→On-site→Commission→Active), shipment + commissioning panels; the Osaka EAR99 customs hold.
- **Quality & Testing** — **SPC control chart** (torque vs UCL/LCL), defect Pareto, certs (CE/UL/ISO), open NCRs.
- **Sales & CRM** — pipeline funnel + Q3 forecast; deals carry an agent-checked **deliverability** signal (sales↔ops bridge).
- **Marketing** — demand funnel + pipeline-by-channel attribution + campaigns; hands SQLs to Sales.
- **Fleet** — deployed robots: map/telemetry, uptime, OTA, predictive alerts.
- **Field Service** — **technician dispatch board** + work-order queue with live SLA countdowns; picks up Fleet alerts.
- **Engineering & PLM** — ECO change-order pipeline + **HW↔firmware compatibility matrix** + firmware releases.
- **Autonomy (Robotics Ops)** — autonomy-rate trend (policy-canary regression), safety incidents, policy versions/rollback.
- **Finance** — two revenue engines (lumpy hardware at commissioning + ratable RaaS), per-unit economics, cash/runway, AR aging.
- **People** — **certification matrix** gating field dispatch, field-team-vs-fleet growth, headcount.
- **Security** — CVE triage, device posture, access, signed-firmware patching.
- **Legal** — contract obligations tracked vs live ops (BMW SLA), export control (dual-use), liability/IP matters.

---

## Agent types relevant to an AI-native robotics ERP

Each module runs ~6 specialized agents under a module orchestrator. Cross-cutting patterns: sourcing/quote/negotiation, monitoring (SPC, telemetry, intervention), root-cause/analysis, dispatch/scheduling, compliance/cert, forecast/planning, reconciliation/match, and a general **Axona agent** that reads across modules. A multi-agent system is the moat.

---

## Reusable assets

- **`erp-domains.md`** — the module domain reference (Core + Value chain + Robotics-specific + Back office + the AI layer).
- **Design system** — bound at `_ds/axona-design-system-…/`; tokens + components (`window.AxonaDesignSystem_4752cf.*`). Brand invariants: Archivo + JetBrains Mono; paper `#fff` / panel `#f4f3ef` / ink `#0a0a0a`; lime `#c6f24f` accent; functional green `#1f9e6f` only (no invented reds); dotted-grid motif; hairlines over shadows; no emoji; say "operating system," not "ERP."
- **Platform component patterns added to the DS:** `AgentGlyph` (dot-ring), `KpiStrip`, plus the agent-trace block.

---

## Conventions for continuing this build

- One `.dc.html` per screen; shared inline-styled app shell copied across (nav edits are scripted find/replace — note `Sales & CRM.dc.html` must be edited by hand, its `&` breaks the script path).
- Add new Core-level panes as top-level siblings under the CORE nav section, propagate the nav item to every screen, and wire ⌘K.
- Design every new module function-first: name what it must do, pick the signature artifact, then build — avoid generic tables/data slop.
