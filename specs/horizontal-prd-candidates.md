# Horizontal platform PRD candidates (from a design partner's hardware-ops "ERP" requirements)

*Source: a robotics design partner's written requirements (marque-free here). These are **horizontal** — every
tenant benefits — and each **reinforces the "operating system" positioning by leveraging an existing moat
primitive** (ONT.1 graph · AUDIT.1 log · FILE.1 blobs · the agent runtime · decide()/WF.1). They are deliberately
NOT the ERP-module sprawl; see "Scope-creep to avoid" at the end for what would turn Axona into a bloated ERP.*

## Why these (the filter)

A requirement earns a horizontal PRD only if it: (1) benefits **every module/tenant**, not one; (2) **extends a
primitive we already own** (so it compounds, not sprawls); (3) makes the app feel like **one connected system**
(the thing "operating system" promises and ERPs fail at); (4) does **not** pull us into generic-ERP scope.

## Tier 1 — build these (core horizontal · leverage a moat primitive · high signal)

- **IO.1 · Universal spreadsheet import/export + AI-assisted extraction.** Create/update **any** entity from
  xlsx/csv, bulk download→edit→re-upload, and **AI-verified import** (e.g. a goods-receipt or a BOM from a file,
  agent pre-checks it). *Their signal (asked ≥5 ways):* "new items from external files," "orders from BOM files,"
  "download/upload data for multiple parts," "GR from external file with AI support," "import BOM from
  Eplan/Solidworks." *Leverages:* PLM.2 `importUnits` + MTX.1 extraction + the agent runtime → generalize into a
  platform capability. **Highest-value, most-requested, most moat-aligned (feeds the loop).**
- **LINK.1 · Connected-objects / "where-used" navigation.** Every entity surfaces its linked entities with
  one-click traverse — "PO line → invoice → warehouse item → reserved qty → open PRs → where used → replacement."
  *Their signal:* the explicit "fast access to connected modules in 2–3 clicks, both directions." *Leverages:*
  ONT.1 entity-graph (already computes this — this is its UI everywhere, not just blast radius).
- **HIST.1 · Per-record audited change history.** Every record shows its full, immutable changelog inline
  (who/what/when, before→after). *Their signal:* "tracking all changes in all docs." *Leverages:* AUDIT.1
  (already the immutable event log — surface it per-record as a timeline).
- **ATTACH.1 · Universal attachments + versioning.** Attach and version files on any entity (drawings, specs,
  certs, POs). *Their signal:* "attachment management," "docs revision management." *Leverages:* FILE.1 blob store
  + the extraction pipeline.

## Tier 2 — strong, moderate scope

- **APPROVAL.1 · Configurable multi-level approval workflows.** Tenant-configurable approval chains + thresholds
  (e.g. high-value PO → multi-level; "for information" routes). *Signal:* "multi-level / for-information approval
  for high-value PO." *Leverages:* `decide()` + WF.1 workflow engine (generalize the gate).
- **AUTH.SSO · Google Workspace SSO.** Wire the (currently disabled) SSO button to Google. *Signal:* "full Google
  account + SSO." *Leverages:* Auth.js. Also an **enterprise go-live enabler** (defense/EU buyers expect SSO).
- **SHARE.1 · External read-only shares (no seat).** Share a filtered view (a project timeline, a stock list, a
  blast-radius report) with an external party via a link, no license. *Signal:* "sharing selected data with
  external companies without license." *Leverages:* RBAC + a scoped read token.
- **COST.1 · Cost-center / project dimension across modules.** Thread a cost-center/project allocation onto
  transactions (stock moves, POs, invoices) for grouping + rollup. *Signal:* "cost center allocation everywhere,"
  "orders assigned to a project/warehouse."

## Tier 3 — narrower / defer

- **SCAN.1 · Barcode/RFID receiving** (real-time inventory on GR) — horizontal across receiving but
  warehouse-flavored; defer.
- **REPORT.1 · Group/pivot any list by dimension** (supplier/project/status) — nice generic reporting layer.
- **DRAFT.1 · Form autosave** ("draft saved automatically after a period") — a UX polish, platform-wide.
- **FLAG.1 · Per-tenant feature on/off** ("on/off for all functionalities") — a config/feature-flag layer.

## Scope-creep to AVOID (stay in the wedge — these are design-partner *co-build*, not platform PRDs)

Chasing these turns Axona into the bloated ERP its buyers reject (and invites SAP). Name them as roadmap we build
*with* a design partner, never core platform work now:

- **Full financials / invoicing / AP engine** (they even flag it "for later").
- **Timesheets / HR / holiday-and-leave planning.**
- **Native CAD connectors** (SolidWorks / Eplan / 3DExperience) — real partner unlock, but integration-heavy;
  IO.1's spreadsheet+AI import covers the 80% first.
- **Low/no-code app builder.**
- **Warehouse pick-path / physical-layout optimization** (a WMS feature, not our lane).
- **Consignment/subcontractor logistics depth, RFID fleets, auction portals.**

## Recommended order

`IO.1 → LINK.1 → HIST.1` first (biggest horizontal leverage, each on a primitive we own), then `ATTACH.1` and
`AUTH.SSO` (enterprise enablers), then Tier 2 as design-partner pull dictates. Each should pass the moat
"feeds-the-loop / compounds" test, and none should cross into the scope-creep list.
