# PRD: CMD.1 — Command Center rollups API

**Status**: Ready for Dev
**Priority**: P0
**Effort**: M (3 days)
**Last Updated**: 2026-06-26
**Backlog Reference**: CMD.1 (E5 Core · Track: Core) · build-spec §4.3, §6 (`GET /api/core/summary`)
**Mode**: Full CPRD (the cross-module rollup + exception feed — the "one signal across ten modules" proof, in data)

---

## Problem Statement

Mission Control shows per-module alert *counts* (MC.1). The Command Center needs the next level: a live
snapshot across every module — per-domain KPIs (open POs, units built, fleet uptime, cash, open quality
issues…) plus a **cross-module exception feed** where one event is shown rippling across domains
("supplier delay threatens 3 builds", "robot SN-2196 flagged → field dispatch"). This story builds
`GET /api/core/summary`: the org-scoped rollup of KPIs-by-module and derived exceptions, from the seeded
narrative. CMD.2 renders it; the copilot (GA.1) answers over it.

## Success Metrics

| Metric | Target |
|---|---|
| `GET /api/core/summary` returns per-module KPIs + a cross-module exception feed, org-scoped | yes |
| KPIs derive from seeded data (no hardcoded numbers) | 100% |
| Exceptions are real (queried) + carry a source link and the modules they ripple to | yes |
| The seeded narrative surfaces as exceptions (NCR-118, DLV-3312 customs, SN-2196, Osei cert, HX-2 margin, BMW SLA, p-13) | all present |
| Latency on the seeded dataset | < 100ms |
| Verify + typecheck | `pnpm verify:cmd-1` green, `tsc` clean |

## User Stories

- As **Head of Ops**, I get one KPI tile per domain (open POs, units built, fleet uptime, cash, open
  quality issues…) so I see the whole company at a glance.
- As **Head of Ops**, I see cross-module exceptions ("supplier delay threatens 3 builds", "robot #214
  flagged") and can click through to the source.
- As a **developer (CMD.2)**, I have one endpoint returning the rollup + exceptions to render.

## Detailed Requirements

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| R1 | `getCoreSummary(orgId)` in `@axona/db` (or `apps/web/lib`) → `{ kpisByModule, exceptions }`, all via `dbForOrg` | P0 | the rollup |
| R2 | `GET /api/core/summary` route returns it; org via `getCurrentUser` | P0 | §6 |
| R3 | Per-module KPIs — a small curated set per agent-bearing module, derived from seeded rows | P0 | see Tech Reqs |
| R4 | Cross-module **exceptions** — derived from queryable conditions, each with `{ id, title, severity, module, sourceLabel, url, ripples[] }` | P0 | the moat feed |
| R5 | `severity` maps to brand tokens (critical→ink, warn→lime/amber-as-lime, ok→green) — **no invented reds** | P0 | design.md |
| R6 | `ripples[]` = the modules an exception affects (curated mapping per exception type) | P0 | the "one signal, ten modules" story |
| R7 | Top-level KPIs (company): open exceptions count, units in build, fleet uptime avg, cash/runway, open quality issues | P1 | the header strip |
| R8 | `verify-cmd-1.ts` + `docs/manual-checks.md`; `tsc` clean | P0 | DoD |

## Acceptance Criteria

- [ ] `GET /api/core/summary` returns `{ company, kpisByModule, exceptions }`, org-scoped; numbers come from seeded rows (change the seed → numbers change).
- [ ] `kpisByModule` covers the agent-bearing modules with 2–4 KPIs each (e.g. Procurement: open POs, awaiting approval; Quality: open NCRs, SPC breaches; Fleet: uptime %, units in watch/fault; Finance: AR overdue, margin trend).
- [ ] `exceptions` is a ranked feed where each item has a title, severity (ink/lime/green — never red), the source module + a link to the object, and a `ripples` list of affected modules.
- [ ] The seeded narrative appears as exceptions: NCR-118 (Quality → Engineering/Procurement/Fulfillment), DLV-3312 customs hold (Fulfillment → Legal/Finance), SN-2196 thermal (Fleet → Field Service), Osei HV cert expiring (People → Field Service), HX-2 margin −2.1pt (Finance), BMW SLA at-risk (Legal → Autonomy), agent-drafted PO awaiting approval (Procurement), p-13 canary regression (Autonomy → Fleet).
- [ ] Org isolation: org B's summary never includes org A's rows.
- [ ] `pnpm verify:cmd-1` green; `tsc` clean; committed + pushed.

## Technical Requirements

### Shape — `apps/web/lib/core-summary.ts`

```ts
import { dbForOrg } from "@axona/db";

export type Severity = "critical" | "warn" | "ok";   // → ink | lime | green (no red)
export interface Kpi { key: string; label: string; value: string | number; hint?: string; severity?: Severity; }
export interface ModuleKpis { module: string; label: string; href: string; kpis: Kpi[]; }
export interface Exception {
  id: string; title: string; severity: Severity;
  module: string; sourceLabel: string; url: string;   // link to the object
  ripples: string[];                                   // modules it affects
}
export interface CoreSummary { company: Kpi[]; kpisByModule: ModuleKpis[]; exceptions: Exception[]; }

export async function getCoreSummary(orgId: string): Promise<CoreSummary> {
  const db = dbForOrg(orgId);
  // run the per-module KPI queries + exception queries in parallel (Promise.all)
  // …shape below
}
```

### Per-module KPIs (derive from seeded data; curated, bounded)

| Module | KPIs |
|---|---|
| Procurement | open POs (count); awaiting approval (count, severity warn if >0) |
| Manufacturing | work orders in progress; serials built |
| Quality | open NCRs (critical if any CRITICAL); SPC breaches (samples over UCL/under LCL) |
| Fulfillment | deliveries in flight; at-risk/holds (warn) |
| Fleet | avg uptime %; units in WATCH/FAULT (warn) |
| Field Service | open work orders; SLA due <24h (warn) |
| Engineering | ECOs in review; firmware awaiting cert |
| Autonomy | open safety incidents; policy canaries active |
| Finance | AR overdue (count/amount, warn); margin trend |
| People | techs with cert expiring <30d (warn) |
| Security | open CVEs |
| Legal | obligations at-risk (warn); export holds |

(SPC breach + "below reorder" style need `$queryRaw` for column compares / aggregates — same pattern as ART.2.)

### Exceptions (the cross-module feed)

Derive from queryable conditions, then attach a curated `ripples` mapping. Each exception is real (the row
exists) but the cross-module annotation is the narrative. Examples:

```ts
// critical NCR → exception with ripples
const ncr = await db.nCR.findFirst({ where: { severity: "CRITICAL", status: { not: "CLOSED" } } });
if (ncr) exceptions.push({
  id: `ncr-${ncr.id}`, title: `${ncr.code}: ${ncr.defect}`, severity: "critical",
  module: "quality", sourceLabel: ncr.code, url: `/quality`,
  ripples: ["engineering", "procurement", "fulfillment"],
});

// customs-held delivery
const hold = await db.delivery.findFirst({ where: { stage: "CUSTOMS", NOT: { riskState: "" } } });
if (hold) exceptions.push({ id:`dlv-${hold.id}`, title:`${hold.code} held at customs (${hold.riskState})`, severity:"warn", module:"fulfillment", sourceLabel: hold.code, url:"/fulfillment", ripples:["legal","finance"] });

// watch/fault robot → field service
// expiring tech cert → field service
// overdue invoice → finance
// at-risk obligation → legal/autonomy
// policy canary regression → autonomy/fleet
// PO awaiting approval → procurement
```

Rank exceptions: critical first, then warn; cap (e.g. 12). Keep titles short.

### Route — `apps/web/app/api/core/summary/route.ts`

```ts
export const dynamic = "force-dynamic";
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ company: [], kpisByModule: [], exceptions: [] });
  return Response.json(await getCoreSummary(user.orgId));
}
```

## UX Flow

```
GET /api/core/summary (org-scoped)
   ├─ company KPIs: [ open exceptions · units in build · fleet uptime · cash · open quality ]
   ├─ kpisByModule: Procurement[open POs, awaiting] · Quality[NCRs, breaches] · Fleet[uptime, watch] · …
   └─ exceptions (ranked):
        ● NCR-118: drive torque over UCL        crit   quality   → engineering · procurement · fulfillment
        ● DLV-3312 held at customs (EAR99)       warn   fulfillment → legal · finance
        ● SN-2196 thermal anomaly                warn   fleet      → field-service
        … (link each to its module/object)
   (CMD.2 renders; GA.1 copilot answers over the same data)
```

## Edge Cases

| Case | Handling |
|---|---|
| Seeded status strings differ from predicates | tune predicates to the actual seed (as MC.1 did); verify proves the narrative exceptions appear |
| No exceptions (empty org) | empty feed; KPIs zeroed; no crash |
| Column compares / aggregates (SPC breach, reorder) | `$queryRaw`, scoped to orgId |
| Severity color | critical→ink, warn→lime, ok→green; never red |
| Large counts | display "99+"; ripples deduped |
| Org isolation | every query via `dbForOrg`; verify with a second org |
| Performance | parallelize queries (`Promise.all`); cap exceptions |

## Out of Scope

- The Command Center screen UI (CMD.2 — KPI grid, exception feed, copilot entry).
- The copilot itself (GA.1, done) — CMD.2 wires it.
- Per-module deep KPIs beyond the curated set (module screens own their full detail).
- Real-time push/refresh (poll/refetch in CMD.2; SSE later if needed).

## Dependencies

| Dependency | Status | Blocks What |
|---|---|---|
| FND.12 seeded narrative | Done | the KPIs + exceptions |
| FND.11 `dbForOrg` | Done | scoped queries |
| MC.1 `getModuleAlerts` | Done | predicate patterns to reuse/extend |

## Implementation Plan

**Day 1** — `getCoreSummary` skeleton + per-module KPI queries (parallel) + company KPIs.
**Day 2** — exception derivation (each narrative condition + ripples mapping) + ranking/cap.
**Day 3** — route + verify-cmd-1 (narrative exceptions present, isolation, shape) + manual-checks + commit/push.

## Verification Script

`src/scripts/verify-cmd-1.ts`:

```ts
// Run: pnpm verify:cmd-1   (data checks require seeded DB)
async function run() {
  let passed = 0, failed = 0;
  const fs = await import("fs");
  const check = async (l: string, fn: () => boolean | Promise<boolean>) => {
    try { const ok = await fn(); console.log(`  ${ok ? "PASS" : "FAIL"} ${l}`); ok ? passed++ : failed++; }
    catch (e) { console.log(`  FAIL ${l} — ${(e as Error).message}`); failed++; }
  };
  console.log("\nVerifying CMD.1 — Command Center rollups\n");

  await check("summary lib + route exist", () => fs.existsSync("apps/web/lib/core-summary.ts") && fs.existsSync("apps/web/app/api/core/summary/route.ts"));

  if (!process.env.DATABASE_URL) { console.log("  SKIP data checks — DATABASE_URL not set"); }
  else {
    const { prisma } = await import("@axona/db");
    const { getCoreSummary } = await import("../../apps/web/lib/core-summary");
    const org = await prisma.org.findFirst({ where: { name: "Axona Demo Co" } });
    const s = await getCoreSummary(org!.id);

    await check("kpisByModule covers core modules", () => ["procurement","quality","fleet","finance"].every((m) => s.kpisByModule.some((k: any) => k.module === m)));
    await check("exceptions present + shaped", () => s.exceptions.length >= 5 && s.exceptions.every((e: any) => e.url && Array.isArray(e.ripples) && ["critical","warn","ok"].includes(e.severity)));
    await check("NCR-118 surfaces as a critical exception with ripples", () => s.exceptions.some((e: any) => /NCR-118/.test(e.title) && e.severity === "critical" && e.ripples.length >= 1));
    await check("DLV-3312 customs hold surfaces", () => s.exceptions.some((e: any) => /DLV-3312/.test(e.title)));
    await check("no red severities (ink/lime/green only)", () => s.exceptions.every((e: any) => ["critical","warn","ok"].includes(e.severity)));

    const second = await prisma.org.findFirst({ where: { name: "Isolation Test Co" } });
    await check("org isolation — second org has its own (smaller) summary", async () => { const s2 = await getCoreSummary(second!.id); return s2.exceptions.length <= s.exceptions.length; });
  }

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else { console.log(`\nFAILED — ${failed} check(s) failed`); process.exit(1); }
}
run();
```

## Append to docs/manual-checks.md

```
## CMD.1 — Command Center rollups API
**Automated**
- `pnpm verify:cmd-1` — lib+route; kpisByModule covers core modules; exceptions shaped + NCR-118/DLV-3312 present; no red; isolation.
- `pnpm typecheck` clean.

**Manual (docker up)**
- [ ] curl localhost:3001/api/core/summary | jq → company KPIs, kpisByModule, exceptions.
- [ ] Exceptions include the narrative (NCR-118, DLV-3312, SN-2196, Osei cert, HX-2 margin, BMW SLA, p-13) with ripples + links.
- [ ] Numbers match the seed; change a seeded row → number changes.
```

## Common Mistakes to Avoid

1. **Hardcoded KPI numbers** — every value comes from `dbForOrg` queries over the seed.
2. **Red severities** — critical = ink, warn = lime, ok = green. No invented reds.
3. **Predicates that miss the seed** — confirm seeded status strings so NCR-118/DLV-3312/etc. actually surface.
4. **Serial per-query latency** — `Promise.all` the rollup; cap exceptions.
5. **Unscoped queries** — `dbForOrg` only; verify with a second org.
6. **Fat payload** — curated KPIs + capped exceptions, not raw rows.

## Cursor Rules for This Story

- `getCoreSummary(orgId)` — all queries via `dbForOrg`, parallelized; numbers from the seed, never hardcoded.
- Exceptions are real rows + a curated `ripples` mapping; severity ink/lime/green (no red); each links to its object.
- The narrative must surface (NCR-118, DLV-3312, SN-2196, Osei, HX-2, BMW SLA, p-13).
- Route org-scoped via `getCurrentUser`; cap exceptions; `$queryRaw` for column compares.

## Rollback Plan

Revert the CMD.1 commit (`lib/core-summary.ts`, the `/api/core/summary` route, verify script). No schema
or data change — read-only rollup. Zero data risk.
