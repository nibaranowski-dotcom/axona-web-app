# PRD: MC.1 — Mission Control (launcher)

**Status**: Ready for Dev
**Priority**: P0
**Effort**: M (3 days)
**Last Updated**: 2026-06-26
**Backlog Reference**: MC.1 (E5 Core · Track: Core) · build-spec §4.1
**Mode**: Full CPRD (the post-login home; first screen with live seeded data + alert rollups)

---

## Problem Statement

`/` currently shows a "Pick a module" placeholder inside the shell (FND.13). Mission Control is the
post-login landing — a Mac-launchpad-style grid of every module, grouped Core / Value chain / Robotics /
Back office, each tile a one-line description plus a live alert count so a user lands and immediately
sees where attention is needed (build-spec §4.1). Without it, the home is dead and the seeded narrative
(NCR-118, SN-2196, DLV-3312, p-13, overdue Kawasaki invoice…) is invisible at the top level. This story
replaces the placeholder with the real launcher and the first cross-module alert rollup.

## Success Metrics

| Metric | Target |
|---|---|
| `/` renders the launcher grid with all 22 modules grouped into the 4 bands | yes |
| Each tile shows name + one-line description + (when non-zero) a live alert count | yes |
| Alert counts derive from the seeded demo-org data via `dbForOrg` | yes |
| Clicking a tile routes to `/<module.key>` | yes |
| The launcher search field opens Search (`/search?q=…`) carrying the query | yes |
| Tokens only · no emoji · hairlines · alert chips use ink (no invented reds) | 0 violations |
| Verify + typecheck + a11y | `pnpm verify:mc-1` green, `tsc --noEmit` clean, accessibility-review 0 violations |

## User Stories

- As **any user**, I land on `/` and see all apps grouped Core / Value chain / Robotics / Back office,
  and I launch any one by clicking its tile.
- As **any user**, I see a per-module alert count on the tiles that have live exceptions (Quality,
  Fleet, Finance…) so I know where to go first.
- As **any user**, I type in the launcher search field (or press ⌘K) and it takes me to the Search
  palette carrying my query.

## Detailed Requirements

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| R1 | Replace the FND.13 placeholder landing at `/` with the launcher grid (inside the shell `<main>`) | P0 | remove the `// TODO MC.1` placeholder |
| R2 | Render all 22 modules as tiles grouped by `ModuleGroup` (Core/Value chain/Robotics/Back office) | P0 | reads modules from DB (FND.13 `getNavModules` reuse/extend) |
| R3 | Each tile: a restrained glyph/lettermark + module name + one-line description | P0 | descriptions from a static `moduleMeta` map (no schema change) |
| R4 | Per-module alert counts from seeded data via `dbForOrg(currentUser.orgId)` | P0 | bounded query set (see Tech Reqs); others render no chip |
| R5 | Tile click → `/<module.key>`; Mission Control tile/`/` is not a self-link | P0 | unbuilt routes 404 until their stories (expected) |
| R6 | Launcher search field → `/search?q=<query>` on submit; ⌘K still focuses it | P0 | palette is SRCH.3 |
| R7 | Alert chip styling: ink (critical = ink, never red); restrained; absent when count is 0 | P0 | design.md |
| R8 | Empty/loading/error states for the data fetch | P0 | DoD |
| R9 | `verify-mc-1.ts` + `docs/manual-checks.md` entry; `tsc --noEmit` clean; a11y pass | P0 | DoD |

## Acceptance Criteria

- [ ] `/` shows the launcher: four labeled bands, 22 tiles total, each with name + one-line description.
- [ ] Tiles for modules with live exceptions show an alert count chip (e.g. Quality ≥1 from NCR-118, Fleet ≥1 from SN-2196 WATCH, Finance ≥1 from the overdue Kawasaki invoice, Procurement ≥1 from the agent-drafted PO awaiting approval); modules with no alerts show no chip.
- [ ] Alert counts come from the demo org's seeded rows through `dbForOrg`, not hardcoded.
- [ ] Clicking a tile navigates to `/<key>`; the launcher's own entry doesn't self-link.
- [ ] Typing in the search field and submitting routes to `/search?q=…`; ⌘K focuses it.
- [ ] Alert chips are ink-on-light (no red); single lime signal preserved; no emoji; hairlines not shadows.
- [ ] Loading shows a tile skeleton; empty (no modules) and error states render without breaking the shell.
- [ ] `pnpm verify:mc-1` green; `pnpm typecheck` clean; accessibility-review 0 violations; committed + pushed.

## Technical Requirements

### Module presentation meta — `apps/web/lib/module-meta.ts`

`Module` has no `description` column (no schema change in this story). Keep presentation copy in a static
map keyed by `Module.key`. One line each, manufacturing/robotics-accurate.

```ts
export interface ModuleMeta { description: string; glyph: string; } // glyph = 1–2 char lettermark
export const moduleMeta: Record<string, ModuleMeta> = {
  core:          { description: "Live snapshot across every module", glyph: "CC" },
  agents:        { description: "Every module's agents in one roster", glyph: "AG" },
  workflows:     { description: "Cross-module agent orchestrations", glyph: "WF" },
  projects:      { description: "Workspaces with AI file matrices", glyph: "PR" },
  machines:      { description: "Own plant & mobile equipment register", glyph: "MC" },
  search:        { description: "Universal search across everything", glyph: "SE" },
  procurement:   { description: "Agent-drafted sourcing → PO lifecycle", glyph: "PC" },
  manufacturing: { description: "Line execution + per-unit genealogy", glyph: "MF" },
  inventory:     { description: "Stock, reorder, RMA, spares", glyph: "IN" },
  fulfillment:   { description: "Delivery-as-a-project after QC", glyph: "FU" },
  quality:       { description: "SPC vs spec + defect containment", glyph: "QA" },
  sales:         { description: "Capital-equipment selling with ops feasibility", glyph: "SL" },
  marketing:     { description: "Demand-gen feeding Sales", glyph: "MK" },
  fleet:         { description: "Deployed robots as live assets", glyph: "FL" },
  "field-service":{ description: "Triage → dispatch → beat the SLA clock", glyph: "FS" },
  engineering:   { description: "Product definition + change control", glyph: "EN" },
  autonomy:      { description: "Do robots do their jobs well & safely", glyph: "AU" },
  finance:       { description: "Two revenue engines on one P&L", glyph: "FN" },
  people:        { description: "Certification & competency management", glyph: "PE" },
  security:      { description: "The connected-robot attack surface", glyph: "SC" },
  legal:         { description: "Obligations vs live ops, export, liability", glyph: "LG" },
  // mission-control (/) is the launcher itself — not a tile target
};
```

Match keys to the seeded `Module.key` values exactly. If a seeded key has no meta entry, fall back to
the module name as description and a 2-letter glyph — and the verify script flags the gap.

### Alert rollup — `apps/web/lib/module-alerts.ts`

Bounded, real queries against the seeded narrative; everything scoped via `dbForOrg`. Modules without a
defined query return 0 (no chip). CMD.1 later expands this into the full KPI rollup.

```ts
import { dbForOrg } from "@axona/db";

export async function getModuleAlerts(orgId: string): Promise<Record<string, number>> {
  const db = dbForOrg(orgId);
  const soon = new Date(Date.now() + 24 * 3600 * 1000);
  const [
    poApproval, openCriticalNcr, atRiskDeliveries, watchRobots, slaSoon,
    openIncidents, overdueInvoices, atRiskObligations, ecosInReview, openCves,
  ] = await Promise.all([
    db.purchaseOrder.count({ where: { status: "AWAITING_APPROVAL" } }),
    db.nCR.count({ where: { severity: { in: ["CRITICAL", "MAJOR"] }, status: { not: "CLOSED" } } }),
    db.delivery.count({ where: { NOT: { riskState: "" } } }),
    db.robot.count({ where: { status: { in: ["WATCH", "FAULT"] } } }),
    db.workOrderField.count({ where: { slaDueAt: { lte: soon }, status: { not: "CLOSED" } } }),
    db.safetyIncident.count({ where: { status: { not: "CLOSED" } } }),
    db.invoice.count({ where: { status: "OVERDUE" } }),
    db.obligation.count({ where: { state: "AT_RISK" } }),
    db.eCO.count({ where: { stage: "REVIEW" } }),
    db.cVE.count({ where: { status: { not: "CLOSED" } } }),
  ]);
  return {
    procurement: poApproval,
    quality: openCriticalNcr,
    fulfillment: atRiskDeliveries,
    fleet: watchRobots,
    "field-service": slaSoon,
    autonomy: openIncidents,
    finance: overdueInvoices,
    legal: atRiskObligations,
    engineering: ecosInReview,
    security: openCves,
  };
}
```

(If a seeded status enum/string differs, e.g. there is no "CLOSED" literal, adjust the predicate to the
actual seeded values — keep the intent: count the live exceptions.)

### Page — `apps/web/app/(shell)/page.tsx`

```tsx
import { getNavModules } from "@/lib/nav";
import { getModuleAlerts } from "@/lib/module-alerts";
import { getCurrentUser } from "@/lib/session";
import { Launcher } from "@/components/core/Launcher";

export default async function MissionControl() {
  const user = await getCurrentUser();           // TODO AUTH.1
  const [groups, alerts] = await Promise.all([
    getNavModules(),
    user ? getModuleAlerts(user.orgId) : Promise.resolve({}),
  ]);
  return <Launcher groups={groups} alerts={alerts} />;
}
```

### Components — `apps/web/components/core/`

- **`Launcher.tsx`** (client or server): a header ("Mission Control", small JetBrains-Mono kicker), a
  prominent **search field** (form → `router.push('/search?q='+q)` on submit; also focusable by ⌘K), and
  the four bands. Each band: an uppercase group label + a responsive tile grid
  (`grid` with `repeat(auto-fill, minmax(220px, 1fr))`, 12–16px gap).
- **`AppTile.tsx`**: a `<Link href={'/'+key}>` card on `--paper` with a hairline (`border-line`),
  `rounded-card`; contains the glyph (a small `--panel-2` square with the lettermark in JetBrains Mono),
  the module name (Archivo, `text-ink-strong`), the one-line description (`text-ink-muted`), and — when
  `alert > 0` — an **alert chip** top-right: `bg-ink-strong text-paper` pill with the count in JetBrains
  Mono (critical = ink, never red). Hover: `bg-panel`/`border-line-strong`; `focus-visible:ring-accent`.
- Skeleton, empty ("No modules — run the seed"), and error states.

The Mission Control entry itself is not rendered as a tile target (it's the current page); render the
other 21 modules (Search may render as a tile that routes to `/search`, or be represented only by the
search field — pick one and note it).

## UX Flow

```
/  (post-login landing, inside the shell)
   │
   ├─ "Mission Control"  + [ search field …………………… ⌘K ]  ──submit──► /search?q=…
   │
   ├─ CORE          ▭ Command Center  ▭ Agents  ▭ Workflows  ▭ Projects  ▭ Machines
   ├─ VALUE CHAIN   ▭ Procurement[1]  ▭ Manufacturing  ▭ Inventory  ▭ Fulfillment[1]  ▭ Quality[1]  ▭ Sales  ▭ Marketing
   ├─ ROBOTICS      ▭ Fleet[1]  ▭ Field Service[1]  ▭ Engineering[1]  ▭ Autonomy[1]
   └─ BACK OFFICE   ▭ Finance[1]  ▭ People  ▭ Security  ▭ Legal[1]
        │                 └ [n] = ink alert chip from seeded exceptions (absent when 0)
        click ─► /<key>   (screen renders when its story lands; 404 until then)
```

## Edge Cases

| Case | Handling |
|---|---|
| Seeded status strings differ from the predicates | adjust predicates to actual seeded values; verify proves ≥1 alert exists where the narrative implies one |
| A module key has no `moduleMeta` entry | fall back to name as description + 2-letter glyph; verify flags missing meta |
| Unbuilt module route clicked | 404 via the shell until that screen's story — expected, documented |
| No current user (pre-AUTH) | `getCurrentUser` stub returns demo ADMIN; alerts scoped to demo org |
| DB down | error state in `<main>`; shell + sidebar still render |
| Alert count very large | chip shows the number; cap display at "99+" |
| Search submitted empty | route to `/search` with no query (palette handles empty) |

## Out of Scope

- The Search palette itself (SRCH.3) — launcher only routes to `/search`.
- The full Command Center KPI rollup + exception feed (CMD.1/CMD.2) — MC.1's alert counts are a bounded subset.
- The module screens themselves (their own stories).
- Real auth (AUTH.1) and action-level RBAC.
- Drag-to-reorder / favorites / recents on the launcher (future polish).

## Dependencies

| Dependency | Status | Blocks What |
|---|---|---|
| FND.13 shell + `getNavModules` + session stub | Done | layout, nav data, current user |
| FND.12 seeded modules + narrative | Done | tiles + alert counts |
| FND.11 `dbForOrg` | Done | scoped alert queries |
| FND.2 tokens | Done | tile styling |

## Implementation Plan

**Day 1** — `moduleMeta` map + `getModuleAlerts` (verify each predicate returns the expected seeded count) + page wiring.
**Day 2** — `Launcher` + `AppTile` (grid, glyph, alert chip, hover/focus) + search field → `/search?q=`; skeleton/empty/error.
**Day 3** — a11y (focus order, AA contrast, keyboard), accessibility-review, verify-mc-1 + manual-checks, commit/push.

## Verification Script

`src/scripts/verify-mc-1.ts`:

```ts
// Run: pnpm verify:mc-1   (data checks require a seeded DB / DATABASE_URL)
async function run() {
  let passed = 0, failed = 0;
  const fs = await import("fs");
  const read = (p: string) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  const check = async (label: string, fn: () => boolean | Promise<boolean>) => {
    try { const ok = await fn(); console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`); ok ? passed++ : failed++; }
    catch (e) { console.log(`  FAIL ${label} — ${(e as Error).message}`); failed++; }
  };
  console.log("\nVerifying MC.1 — Mission Control launcher\n");
  const base = "apps/web";

  await check("launcher page replaces placeholder", () => /Launcher/.test(read(`${base}/app/(shell)/page.tsx`)) && !/TODO MC\.1/.test(read(`${base}/app/(shell)/page.tsx`)));
  await check("AppTile + Launcher components exist", () => fs.existsSync(`${base}/components/core/Launcher.tsx`) && fs.existsSync(`${base}/components/core/AppTile.tsx`));
  await check("moduleMeta map present", () => /moduleMeta/.test(read(`${base}/lib/module-meta.ts`)));
  await check("alerts scoped via dbForOrg", () => /dbForOrg/.test(read(`${base}/lib/module-alerts.ts`)));
  await check("alert chip uses ink, not red", () => { const t = read(`${base}/components/core/AppTile.tsx`); return /bg-ink-strong/.test(t) && !/#?(red|f00|ff0000)/i.test(t); });
  await check("search field routes to /search", () => /\/search/.test(read(`${base}/components/core/Launcher.tsx`)));
  await check("no emoji / no raw hex in core components", () => { const t = read(`${base}/components/core/Launcher.tsx`) + read(`${base}/components/core/AppTile.tsx`); return !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t) && !/#[0-9a-fA-F]{3,6}\b/.test(t); });

  if (!process.env.DATABASE_URL) { console.log("  SKIP data checks — DATABASE_URL not set"); }
  else {
    const { getModuleAlerts } = await import(`../../apps/web/lib/module-alerts`);
    const { prisma } = await import("@axona/db");
    const org = await prisma.org.findFirst({ where: { name: "Axona Demo Co" } });
    await check("alerts present where narrative implies (quality, fleet, finance, procurement)", async () => {
      const a = await getModuleAlerts(org!.id);
      return a.quality >= 1 && a.fleet >= 1 && a.finance >= 1 && a.procurement >= 1;
    });
    await check("every moduleMeta key matches a seeded module", async () => {
      const { moduleMeta } = await import(`../../apps/web/lib/module-meta`);
      const keys = new Set((await prisma.module.findMany({ select: { key: true } })).map((m: any) => m.key));
      return Object.keys(moduleMeta).every((k) => keys.has(k));
    });
  }

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else { console.log(`\nFAILED — ${failed} check(s) failed`); process.exit(1); }
}
run();
```

## Append to docs/manual-checks.md

```
## MC.1 — Mission Control (launcher)
**Automated**
- `pnpm verify:mc-1` — page/components, moduleMeta, dbForOrg alerts, ink chips, + data checks (alerts present, meta keys valid).
- `pnpm typecheck` clean.

**Manual (docker up + pnpm --filter @axona/web dev, http://localhost:3001)**
- [ ] `/` shows the launcher: 4 bands, 22 tiles, each with name + one-line description.
- [ ] Alert chips appear on Quality / Fleet / Finance / Procurement (and others with seeded exceptions); chips are ink, not red.
- [ ] Click a built tile (e.g. itself stays; unbuilt routes 404 — expected for now).
- [ ] Type in the search field + submit → /search?q=… ; ⌘K focuses it.
- [ ] No emoji; hairlines (no shadows); single lime signal; Archivo names + JetBrains Mono glyphs/labels.
- [ ] accessibility-review: AA contrast + focus order pass.
```

## Common Mistakes to Avoid

1. **Hardcoding alert counts** — they must come from `dbForOrg(orgId)` over seeded rows, or the launcher lies the moment data changes.
2. **Red alert chips** — banned; critical = ink (`bg-ink-strong text-paper`). Lime stays the single signal.
3. **Predicates that don't match the seed** — confirm the seeded status strings (e.g. NCR `status`, Robot `status`) so counts are actually > 0 where the narrative implies an exception.
4. **A second hardcoded module list** — reuse `getNavModules`/DB; only the descriptions live in `moduleMeta`.
5. **Making the launcher full-screen and dropping the shell** — keep it inside the shell `<main>` (the sidebar stays); it replaces only the placeholder landing.
6. **Self-linking the Mission Control tile** — don't render `/` as a tile target.
7. **Forgetting empty/loading/error** — required by the DoD.

## Cursor Rules for This Story

- Launcher lives in the shell `<main>` at `/`; remove the FND.13 `// TODO MC.1` placeholder.
- Module list from the DB; descriptions/glyphs from `moduleMeta` keyed by `Module.key`.
- Alert counts via `dbForOrg(currentUser.orgId)` only; chips are ink; absent when 0.
- Search field routes to `/search?q=`; ⌘K focuses it; palette is SRCH.3 (out of scope).
- Tokens only, no emoji, hairlines not shadows; run accessibility-review before done.

## Rollback Plan

Revert the MC.1 commit (`app/(shell)/page.tsx` back to the FND.13 placeholder, plus `components/core/*`
and `lib/{module-meta,module-alerts}.ts`, verify script). No schema or data changes. Zero data risk.
