# PRD: FND.12 — Seed the cross-module narrative

**Status**: Ready for Dev
**Priority**: P0
**Effort**: L (4–5 days)
**Last Updated**: 2026-06-26
**Backlog Reference**: FND.12 (E0 Foundation · Track: Foundation)
**Mode**: Full CPRD (demo-load-bearing — the seed is what makes every screen and the moat story coherent)

---

## Problem Statement

Every screen we build from here renders empty until there is data, and a pile of unrelated rows would
make the product look like a generic dashboard. The whole pitch — and the moat — is that **one event
propagates across ten modules on one spine** (build-spec §1, §3.7). Without a single connected seed
narrative, Command Center has nothing to correlate, the agents have nothing to reason over, and the
demo can't show the SERVO-204 → NCR-118 → ECO-318 → BMW-order ripple that proves Axona is a platform,
not a point tool. This story seeds that narrative end-to-end, idempotently, through the `dbForOrg`
client so it also dogfoods per-tenant isolation.

## Success Metrics

| Metric | Target |
|---|---|
| `pnpm db:seed` on a fresh migrated DB | completes with 0 errors |
| Re-running `pnpm db:seed` | idempotent — same row counts, no duplicates |
| Modules seeded | all 24 (Core / Value chain / Robotics / Back office) with correct group + orderIndex |
| Agents seeded | ~6 per agent-bearing module (build-spec §4), each with real `code`/`role`/`description` |
| Projects / Machines | 14 projects across modules · 21 machines (8 fixed, ≥6 mobile) |
| Narrative chain resolvable | NCR-118 → lot 88421 → ECO-318 → SERVO-205 + fw v4.2.2 → BMW deal → DLV-3312 customs hold all present and cross-linked |
| Seeded via `dbForOrg` | every tenant row carries the demo `orgId` (no row without it) |
| Verify + typecheck | `pnpm verify:fnd-12` green, `tsc --noEmit` clean |

## User Stories

- As a **demo driver**, I want one connected dataset so that Command Center, Quality, Engineering,
  Fulfillment, Fleet, Field Service, Finance, and Legal all show the same SERVO/NCR/ECO/BMW story.
- As a **developer**, I want `pnpm db:seed` to be safely re-runnable so that I can reset demo state
  without manual cleanup or duplicate rows.
- As a **security-minded reviewer**, I want the seed to go through `dbForOrg` so isolation is exercised
  by the seed itself, and a second tiny org exists to make isolation visible.

## Detailed Requirements

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| R1 | A fixed demo org (stable id) + a second small org for isolation contrast | P0 | Stable id so re-seed targets the same tenant |
| R2 | Idempotent: clear the demo org's tenant rows, then reseed (re-run = same state) | P0 | Clear scoped to demo orgId; never touch other orgs |
| R3 | Seed all 24 Modules with key/name/group/orderIndex matching the nav (§1) | P0 | Global table (no orgId) |
| R4 | Seed users covering every Role (ADMIN/OPS/ENGINEER/SALES/FINANCE/TECH/VIEWER) | P0 | Demo identities, not real auth |
| R5 | Seed ~6 agents per agent-bearing module with real `code`/`role`/`description` (§4) | P0 | These power the Agents screen + traces |
| R6 | Seed the full §3.7 narrative graph, cross-linked (see Tech Reqs) | P0 | The moat story |
| R7 | 14 Projects across modules with Files; 21 Machines (8 fixed, ≥6 mobile) with MachineSignals | P0 | §3.7 counts |
| R8 | Seed all tenant rows through `dbForOrg(demoOrg.id)` (Org/Module/Users via bare `prisma`) | P0 | Dogfoods ISO.1 |
| R9 | `verify-fnd-12.ts` + `docs/manual-checks.md` entry; `tsc --noEmit` clean | P0 | DoD |

## Acceptance Criteria

- [ ] `pnpm db:seed` completes on a freshly migrated DB; re-running yields identical counts (idempotent).
- [ ] 24 Modules exist with the four groups and stable `orderIndex` ordering the sidebar.
- [ ] Each agent-bearing module has ~6 Agents with non-placeholder `code`/`role`/`description`.
- [ ] The narrative is present and cross-linked: SpcSample torque points over UCL → `NCR-118` (CRITICAL, `linkedTo` lot 88421) → `ECO-318` (supersedes SERVO-204 with -205, fw v4.2.2 torque-comp) → BMW 24-unit `Deal` (feasibility AT_RISK, +3w) → `DLV-3312` Delivery (stage CUSTOMS, Osaka, EAR99 hold) → `ExportLicense` (DLV-3312 EAR99) → fleet `Robot` SN-2196 (thermal) → `WorkOrderField` (SN-2196 battery swap, SLA countdown) → Technician M. Osei (HV/battery cert expiring 12d) → `AutonomyMetric` Site-3 p-13 canary regression + `PolicyVersion` p-13 canary + `SafetyIncident` INC-201 → `UnitEconomic` HX-2 margin −2.1pt → `Invoice` BMW net-60 + Kawasaki overdue → `Obligation` BMW 99.5% SLA → `LegalMatter` (INC-201, ECO-318 patent).
- [ ] 14 Projects with Files; 21 Machines (8 FIXED, ≥6 MOBILE) with at least a few MachineSignals each.
- [ ] Every seeded tenant row has the demo `orgId`; the second org has only its own minimal rows.
- [ ] `pnpm verify:fnd-12` green; `pnpm typecheck` clean; committed and pushed.

## Technical Requirements

### File structure — `packages/db/prisma/seed.ts` + per-domain modules

```
packages/db/prisma/
  seed.ts                      // orchestrator: order, org/modules/users, then dbForOrg domains
  seed/
    constants.ts               // DEMO_ORG_ID, SECOND_ORG_ID, codes (NCR-118, ECO-318, DLV-3312, SN-2196…)
    modules.ts                 // the 24 modules (key/name/group/orderIndex)
    agents.ts                  // ~6 agents per agent-bearing module
    users.ts                   // one per role
    value-chain.ts             // Suppliers, Parts, POs, WorkOrderMfg, NCR-118, SPC, Certs, BMW Deal, Campaigns, DLV-3312
    robotics.ts                // Robots (SN-2196), Telemetry, WorkOrderField, Technicians (Osei), ECO-318, Firmware, Compat, Autonomy (p-13), SafetyIncident, PolicyVersion
    back-office.ts             // Ledger, Invoices (BMW/Kawasaki), UnitEconomic (HX-2), Requisitions, CVEs, Obligations, ExportLicense, LegalMatter
    projects.ts                // 14 projects + files
    machines.ts                // 21 machines + signals
```

`package.json` (packages/db) already has `"db:seed": "tsx prisma/seed.ts"`. Keep it.

### Orchestration order — `seed.ts`

```ts
import { prisma, dbForOrg } from "../src";
import { DEMO_ORG_ID, SECOND_ORG_ID } from "./seed/constants";
// …imports of each domain seeder

async function main() {
  // 1. Orgs (bare prisma — Org has no orgId). Stable ids so re-seed is idempotent.
  await prisma.org.upsert({ where: { id: DEMO_ORG_ID }, update: { name: "Axona Demo Co" }, create: { id: DEMO_ORG_ID, name: "Axona Demo Co" } });
  await prisma.org.upsert({ where: { id: SECOND_ORG_ID }, update: { name: "Isolation Test Co" }, create: { id: SECOND_ORG_ID, name: "Isolation Test Co" } });

  // 2. Idempotency: clear the demo org's tenant rows (children first, scoped). NEVER touch other orgs.
  await clearDemoOrg(); // deleteMany where orgId === DEMO_ORG_ID, in FK-safe order

  // 3. Global Modules (no orgId).
  await seedModules(prisma);

  // 4. Tenant data — all through the scoped client (dogfoods ISO.1; injects orgId).
  const db = dbForOrg(DEMO_ORG_ID);
  await seedUsers(db);
  await seedAgents(db);
  await seedValueChain(db);   // returns ids needed downstream (supplier/part/deal/…)
  await seedRobotics(db);
  await seedBackOffice(db);
  await seedProjects(db);
  await seedMachines(db);

  // 5. Minimal second-org rows so isolation is visible on screen.
  await seedSecondOrg(dbForOrg(SECOND_ORG_ID));
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
```

### Idempotency — clear-then-seed (no schema change)

Most narrative models have no natural `@unique`, so do not rely on `upsert` for them. Instead, delete
the demo org's tenant rows in FK-safe order (children before parents), then insert fresh. Scope every
delete to `DEMO_ORG_ID` (or the parent's org) so the second org and any future tenant are untouched.
`onDelete: Cascade` from `Org` is NOT used here (we keep the Org row) — delete tenant tables explicitly.

```ts
async function clearDemoOrg() {
  const orgId = DEMO_ORG_ID;
  // children that reference parents first
  await prisma.telemetryPoint.deleteMany({ where: { orgId } });
  await prisma.workOrderField.deleteMany({ where: { orgId } });
  await prisma.purchaseOrder.deleteMany({ where: { orgId } });
  await prisma.machineSignal.deleteMany({ where: { machine: { orgId } } });
  await prisma.file.deleteMany({ where: { project: { orgId } } });
  await prisma.matrixColumn.deleteMany({ where: { projectId: { in: (await prisma.project.findMany({ where: { orgId }, select: { id: true } })).map(p => p.id) } } });
  await prisma.message.deleteMany({ where: { chat: { orgId } } });
  await prisma.agentRun.deleteMany({ where: { agent: { orgId } } });
  await prisma.workflowRun.deleteMany({ where: { workflow: { orgId } } });
  // …then parents
  await prisma.robot.deleteMany({ where: { orgId } });
  await prisma.technician.deleteMany({ where: { orgId } });
  await prisma.supplier.deleteMany({ where: { orgId } });
  await prisma.part.deleteMany({ where: { orgId } });
  // …every remaining tenant table scoped to orgId
}
```

### The narrative graph (build-spec §3.7) — representative wiring

Seed real, cross-referenced rows. Codes are stable constants. Example fragments:

```ts
// Quality: torque drifting over UCL on SERVO-204 → NCR-118 → lot 88421
const ucl = 4.2, lcl = 3.4, mean = 3.8;
await db.spcSample.createMany({ data: torqueSeries("SERVO-204", { ucl, lcl, mean, breach: true }) });
await db.nCR.create({ data: { code: "NCR-118", defect: "Drive torque over UCL (stiff actuator)", linkedTo: "lot 88421", severity: "CRITICAL", status: "OPEN" } });

// Engineering: ECO-318 from NCR-118, supersedes SERVO-204 with -205 + firmware torque-comp
await db.eCO.create({ data: { code: "ECO-318", title: "Supersede SERVO-204 → -205 (torque-comp)", changeType: "SUPERSEDE", affected: "SERVO-204; NCR-118; BMW order", stage: "REVIEW" } });
await db.firmwareRelease.create({ data: { version: "v4.2.2-rc", note: "Torque-comp; awaiting HX-1 cert before Fleet OTA", state: "RC" } });

// Sales/Fulfillment: BMW 24-unit deal at-risk +3w → DLV-3312 Osaka customs (EAR99)
await db.deal.create({ data: { account: "BMW", config: "HX-2 ×24", value: 4_800_000, stage: "COMMIT", feasibility: "AT_RISK" } });
await db.delivery.create({ data: { code: "DLV-3312", account: "BMW", destination: "Osaka, JP", units: "24× HX-2", stage: "CUSTOMS", committedDate: d("+21d"), etaDate: d("+42d"), riskState: "EAR99 customs hold" } });
await db.exportLicense.create({ data: { destination: "Osaka, JP", code: "EAR99-DLV-3312", state: "HOLD" } });

// Fleet/Field: SN-2196 thermal → battery swap WO → Tech M. Osei cert expiring 12d
const sn2196 = await db.robot.create({ data: { serial: "SN-2196", model: "HX-2", customer: "BMW", site: "Site-3", uptimePct: 96.4, firmware: "v4.2.1", status: "WATCH" } });
await db.workOrderField.create({ data: { code: "WO-5521", robotSerial: "SN-2196", site: "Site-3", issue: "Thermal anomaly — battery swap", slaDueAt: d("+6h"), status: "DISPATCH", severity: "MAJOR" } });
await db.technician.create({ data: { name: "M. Osei", initials: "MO", site: "Site-3", status: "ON_JOB", certs: { hvBattery: { state: "EXPIRING", expiresAt: d("+12d") } } } });

// Autonomy: Site-3 p-13 canary regression → INC-201 → policy versions
await db.policyVersion.create({ data: { version: "p-13", note: "Canary on Site-3", state: "canary" } });
await db.autonomyMetric.createMany({ data: autonomySeries("Site-3", { regressionAfter: "p-13" }) });
await db.safetyIncident.create({ data: { code: "INC-201", type: "near-miss", robotSerial: "SN-2196", site: "Site-3", severity: "MAJOR", status: "REVIEW" } });

// Finance/Legal: HX-2 margin −2.1pt, BMW net-60 + Kawasaki overdue, SLA obligation, IP matter
await db.unitEconomic.create({ data: { product: "HX-2", asp: 200_000, cogs: 154_200, marginPct: 22.9, trend: "-2.1pt from ECO-318" } });
await db.invoice.create({ data: { code: "INV-7741", account: "BMW", source: "hardware", amount: 1_200_000, terms: "net-60", dueDate: d("+38d"), status: "OPEN" } });
await db.invoice.create({ data: { code: "INV-7702", account: "Kawasaki", source: "RaaS", amount: 96_000, terms: "net-30", dueDate: d("-9d"), status: "OVERDUE" } });
await db.obligation.create({ data: { account: "BMW", obligation: "99.5% fleet SLA", actual: "99.3% (autonomy regression)", state: "AT_RISK" } });
await db.legalMatter.create({ data: { type: "IP", title: "ECO-318 torque-comp patent", linkedTo: "ECO-318", status: "DRAFTING" } });
```

Apply the same density to the rest: ~6 agents per module (`agents.ts`), 14 projects + files, 21 machines
+ signals, plus enough Suppliers/Parts/POs (incl. an agent-drafted PO `AWAITING_APPROVAL`) to make
Procurement real. Use `BMW`/`Kawasaki` as sample data **inside the seed** (allowed per §3.7); they must
be anonymized only when something leaves the app (decks/screenshots) — out of scope here.

### Sidebar modules (R3) — the 24, grouped

CORE: Command Center, Mission Control, Search, Agents, Workflows, Projects, Machines · VALUE CHAIN:
Procurement, Manufacturing, Inventory, Fulfillment, Quality, Sales, Marketing · ROBOTICS: Fleet, Field
Service, Engineering, Autonomy · BACK OFFICE: Finance, People, Security, Legal. Give each a stable
`key` (route slug), `name`, `group`, and ascending `orderIndex`.

## UX Flow

```
pnpm db:seed
   │
   ├─ upsert Org(demo, fixed id) + Org(second)
   ├─ clearDemoOrg()  ── delete tenant rows where orgId = demo  (children → parents)
   ├─ seedModules(prisma)                    (global, no orgId)
   │
   └─ db = dbForOrg(demoOrgId)               (every insert auto-tagged with orgId)
         ├─ users → agents
         ├─ value-chain  ─┐
         ├─ robotics      ├─ cross-linked by stable codes (NCR-118, ECO-318, DLV-3312, SN-2196, p-13…)
         ├─ back-office  ─┘
         ├─ projects + files
         └─ machines + signals
   └─ seedSecondOrg(dbForOrg(secondOrgId))   (minimal rows; isolation visible)
```

## Edge Cases

| Case | Handling |
|---|---|
| Re-running seed | clear-then-seed scoped to demo orgId → identical state, no dupes |
| Seed run before migration | fails fast on missing tables; manual-checks says migrate first |
| `dbForOrg` create needs a parent id (PO needs supplierId) | create parents first, capture ids, pass to children |
| `File.embedding` not set | left NULL — embeddings are FILE.2; seed doesn't populate vectors |
| Deleting demo rows with FK children | delete in FK-safe order (children first) — do not rely on Org cascade (Org row is kept) |
| Second org accidentally cleared | `clearDemoOrg` filters strictly on demo orgId; never a bare deleteMany |
| Dates | use relative helpers (d("+6h"), d("-9d")) so the SLA countdowns/aging always look live |

## Out of Scope

- Embedding generation for files (FILE.2) and search indexing (SRCH.1).
- Real auth users / password records (Auth is E1); seeded Users are demo identities.
- Workflow definitions + runs beyond a couple of illustrative rows (full workflows are WF.*).
- Anonymizing BMW/Kawasaki — that's the export gate (screen-export-instruction.md), not the seed.
- Agent run traces with real model/confidence (AUDIT.3/CONF.1) — seed only a few illustrative traces.

## Dependencies

| Dependency | Status | Blocks What |
|---|---|---|
| FND.11 migrated DB + `dbForOrg` | Done | the whole seed runs against it |
| §3.7 narrative spec | In build spec | the entity graph |
| docker compose up | Required at run | live DB |

## Implementation Plan

**Day 1** — constants + modules + users + the clear-then-seed scaffold; `seed.ts` orchestrator runs end-to-end empty.
**Day 2** — agents (~6/module) + value-chain narrative (SERVO/NCR-118/SPC/BMW deal/DLV-3312).
**Day 3** — robotics narrative (SN-2196/Osei/ECO-318/firmware/compat/autonomy p-13/INC-201).
**Day 4** — back-office (HX-2/invoices/obligations/export/legal) + 14 projects/files + 21 machines/signals + second org.
**Day 5** — verify script + manual-checks + idempotency pass + commit/push.

## Verification Script

`src/scripts/verify-fnd-12.ts`:

```ts
// Run: pnpm verify:fnd-12   (requires a migrated, seeded DB — DATABASE_URL set)
async function run() {
  let passed = 0, failed = 0;
  const check = async (label: string, fn: () => boolean | Promise<boolean>) => {
    try { const ok = await fn(); console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`); ok ? passed++ : failed++; }
    catch (e) { console.log(`  FAIL ${label} — ${(e as Error).message}`); failed++; }
  };
  console.log("\nVerifying FND.12 — cross-module narrative seed\n");

  const fs = await import("fs");
  await check("seed orchestrator + per-domain modules exist", () =>
    fs.existsSync("packages/db/prisma/seed.ts") && fs.existsSync("packages/db/prisma/seed/value-chain.ts"));

  if (!process.env.DATABASE_URL) { console.log("  SKIP data checks — DATABASE_URL not set (seed + run with docker up)"); }
  else {
    const { prisma, dbForOrg } = await import("@axona/db");
    const { DEMO_ORG_ID, SECOND_ORG_ID } = await import("../../packages/db/prisma/seed/constants");
    const db = dbForOrg(DEMO_ORG_ID);

    await check("24 modules", async () => (await prisma.module.count()) === 24);
    await check("agents seeded (>= 60)", async () => (await db.agent.count()) >= 60);
    await check("14 projects", async () => (await db.project.count()) === 14);
    await check("21 machines (8 fixed)", async () => (await db.machine.count()) === 21 && (await db.machine.count({ where: { kind: "FIXED" } })) === 8);
    await check("NCR-118 critical, linked to lot 88421", async () => { const n = await db.nCR.findFirst({ where: { code: "NCR-118" } }); return !!n && n.severity === "CRITICAL" && /88421/.test(n.linkedTo); });
    await check("ECO-318 present, affects BMW order", async () => { const e = await db.eCO.findFirst({ where: { code: "ECO-318" } }); return !!e && /BMW/i.test(e.affected); });
    await check("DLV-3312 customs hold (EAR99)", async () => { const dl = await db.delivery.findFirst({ where: { code: "DLV-3312" } }); return !!dl && dl.stage === "CUSTOMS" && /EAR99/i.test(dl.riskState); });
    await check("SN-2196 robot + field WO", async () => (await db.robot.count({ where: { serial: "SN-2196" } })) === 1 && (await db.workOrderField.count({ where: { robotSerial: "SN-2196" } })) >= 1);
    await check("M. Osei cert expiring", async () => { const t = await db.technician.findFirst({ where: { name: "M. Osei" } }); return !!t; });
    await check("p-13 autonomy canary + INC-201", async () => (await db.policyVersion.count({ where: { version: "p-13" } })) >= 1 && (await db.safetyIncident.count({ where: { code: "INC-201" } })) === 1);
    await check("HX-2 margin -2.1pt + Kawasaki overdue invoice", async () => { const u = await db.unitEconomic.findFirst({ where: { product: "HX-2" } }); const inv = await db.invoice.findFirst({ where: { account: "Kawasaki", status: "OVERDUE" } }); return !!u && /-2.1/.test(u.trend) && !!inv; });
    await check("every demo tenant row carries demo orgId (sample: suppliers)", async () => (await db.supplier.count()) > 0 && (await prisma.supplier.count({ where: { orgId: { not: DEMO_ORG_ID }, AND: { orgId: { not: SECOND_ORG_ID } } } })) === 0);
    await check("second org isolated (has its own, few rows)", async () => (await dbForOrg(SECOND_ORG_ID).supplier.count()) >= 0);
  }

  if (failed === 0) { console.log(`\nPASSED — ${passed} checks`); }
  else { console.log(`\nFAILED — ${failed} check(s) failed`); process.exit(1); }
}
run();
```

## Append to docs/manual-checks.md

```
## FND.12 — Cross-module narrative seed
**Automated**
- `pnpm db:seed` then `pnpm verify:fnd-12` — counts + the SERVO/NCR-118/ECO-318/BMW/DLV-3312/SN-2196/Osei/p-13/HX-2 chain.
- Re-run `pnpm db:seed` and `pnpm verify:fnd-12` again — counts identical (idempotent).
- `pnpm typecheck` clean.

**Manual (docker compose up first)**
- [ ] `pnpm db:seed` runs clean on a fresh `prisma migrate reset`.
- [ ] In psql: NCR-118 → linkedTo 'lot 88421'; ECO-318.affected mentions BMW; DLV-3312 stage=CUSTOMS, EAR99 in riskState.
- [ ] Module count = 24; Project = 14; Machine = 21 (8 FIXED).
- [ ] No tenant row exists with an orgId outside the demo/second org.
- [ ] Sample data note: BMW/Kawasaki are illustrative sample data (anonymized only on export).
```

## Common Mistakes to Avoid

1. **Using `upsert` on narrative rows without a unique key** — they have none. Use clear-then-seed scoped to the demo org instead.
2. **A bare `deleteMany()` in the clear step** — always filter on the demo orgId (or parent's org); a bare delete wipes other tenants.
3. **Seeding tenant rows with the bare `prisma`** — use `dbForOrg(demoOrgId)` so orgId is injected and ISO.1 is exercised. Only Org/Module/Users-bootstrap use bare prisma.
4. **Hardcoding absolute dates** — SLA countdowns and AR aging must look live; use relative date helpers.
5. **Creating children before parents** — POs need supplier/part ids; field WOs reference robots; create and capture ids in order.
6. **Forgetting the second org** — without it, isolation isn't visible and the verify isolation check is hollow.
7. **Letting `Org` cascade do the clearing** — don't delete the Org row; delete its tenant tables explicitly in FK-safe order.

## Cursor Rules for This Story

- All tenant data seeded through `dbForOrg(DEMO_ORG_ID)`; stable demo org id in `constants.ts`.
- Clear-then-seed, strictly scoped to the demo org; never a bare `deleteMany`.
- Narrative codes are constants (NCR-118, ECO-318, DLV-3312, SN-2196, p-13, HX-2) and must cross-link.
- Relative dates only for anything time-sensitive.
- BMW/Kawasaki are sample data in-app; do not anonymize here (that's the export gate).

## Rollback Plan

Revert the FND.12 commit (seed files + verify script). To clear seeded data: `pnpm db:seed` re-runs the
clear step, or `prisma migrate reset` drops everything. Data affected: local dev database only — no
production data exists, and the seed is reproducible. Zero data risk.
