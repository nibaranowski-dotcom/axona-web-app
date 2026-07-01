# PRD: CMD.2 — Command Center screen

**Status**: Ready for Dev
**Priority**: P0
**Effort**: M (3–4 days)
**Last Updated**: 2026-06-26
**Backlog Reference**: CMD.2 (E5 Core · Track: Core) · build-spec §4.3
**Mode**: Full CPRD (the flagship cross-module screen; match DS.1 1:1; the platform-thesis view)

---

## Problem Statement

CMD.1 produces the rollup + cross-module exception feed; nothing renders it. The Command Center (`/core`)
is the only horizontal screen — a live snapshot across every module: a KPI grid per domain and an
exception feed where one event visibly ripples across domains, with the Axona copilot (GA.1) able to
answer over the same picture. This is the screen that proves Axona is a platform, not a point tool.

## Success Metrics

| Metric | Target |
|---|---|
| `/core` renders the company KPI strip + per-module KPI grid + the cross-module exception feed | yes |
| Each exception shows severity (ink/lime/green), source link, and the modules it ripples to | yes |
| Clicking an exception routes to its source module/object | yes |
| The Axona copilot (GA.1 pane) is present and answers over the same data | yes |
| Matches DS.1 (`design/prototypes/`) | 1:1 |
| a11y + tokens | accessibility-review 0 violations; no emoji/raw hex |

## User Stories

- As **Head of Ops**, I open `/core` and see one KPI tile per domain (open POs, units built, fleet uptime,
  cash, open quality issues) — the whole company at a glance.
- As **Head of Ops**, I see cross-module exceptions ("NCR-118 → ripples to Engineering/Procurement/
  Fulfillment", "DLV-3312 held at customs → Legal/Finance") and click through to the source.
- As **Head of Ops**, I ask the Axona copilot a cross-module question and it answers over this data.

## Detailed Requirements

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| R1 | `/core` (shell route; static, overrides `[module]` like `/agents`) — server-fetch `getCoreSummary` | P0 | CMD.1 |
| R2 | Company KPI strip — the top-level KPIs (open exceptions, units in build, fleet uptime, cash, open quality) | P0 | `KpiStrip` |
| R3 | Per-module KPI grid — a card per module with its 2–4 KPIs; card links to the module | P0 | `ModuleKpiGrid` |
| R4 | Exception feed — ranked rows: severity dot + title + source link + ripple chips (affected modules) | P0 | `ExceptionFeed` |
| R5 | Exception click → route to `exception.url`; ripple chips → route to that module | P0 | |
| R6 | Copilot entry — an "ask the Axona agent" affordance that opens/seeds the GA.1 agent pane | P0 | reuse GA.1 |
| R7 | Severity → tokens: critical→ink, warn→lime, ok→success green (no red) | P0 | design.md |
| R8 | Built on DS.1; matches `design/prototypes/`; loading/empty/error; a11y | P0 | fidelity gate |
| R9 | `verify-cmd-2.ts` + `docs/manual-checks.md`; `tsc` clean; accessibility-review | P0 | DoD |

## Acceptance Criteria

- [ ] `/core` renders inside the shell: a company KPI strip, a per-module KPI grid, and the exception feed, all from `GET /api/core/summary` (or a server fetch of `getCoreSummary`).
- [ ] The exception feed shows the 8 seeded narrative items, each with a severity dot (ink/lime/green), title, a link to its module/object, and ripple chips for the affected modules.
- [ ] Clicking an exception routes to its source; clicking a ripple chip routes to that module.
- [ ] The per-module KPI cards show the CMD.1 values and link to each module.
- [ ] The Axona copilot is reachable from `/core` (the GA.1 pane) and answers over cross-module data; a copilot entry on the screen focuses/seeds it.
- [ ] Matches DS.1: KPI tiles, feed rows, chips, the dotted-grid/hairline treatment; no emoji, no raw hex, lime = signal (severity uses ink/lime/green). accessibility-review 0 violations.
- [ ] Loading (skeleton), empty (no exceptions), and error states render.
- [ ] `pnpm verify:cmd-2` green; `tsc` clean; committed + pushed.

## Visual Spec (DS.1 — match 1:1)

Reference `design/prototypes/` (Command Center). Build from DS.1 primitives: KPI tiles (value + label +
optional severity dot), the exception feed rows, module/ripple chips (DS.1 Pill), section headers. Severity
dot: critical→ink, warn→lime, ok→success green. Lime remains the single signal beyond severity. JetBrains
Mono for KPI values/labels + module codes; Archivo for headings/titles. Hairlines + surface steps, no
shadows. If a KPI-tile or feed-row primitive isn't in DS.1, compose from DS.1 card/pill/typography and
register it — don't invent off-system styling.

## Technical Requirements

### Route + fetch — `apps/web/app/(shell)/core/page.tsx`

```tsx
import { getCurrentUser } from "@/lib/session";
import { getCoreSummary } from "@/lib/core-summary";
import { CommandCenter } from "@/components/core/CommandCenter";

export default async function CommandCenterPage() {
  const user = await getCurrentUser();
  const summary = user ? await getCoreSummary(user.orgId) : { company: [], kpisByModule: [], exceptions: [] };
  return <CommandCenter summary={summary} />;
}
```

(Server-fetch is fine for first paint; add a client refetch/poll only if you want live refresh — optional.)

### Components — `apps/web/components/core/`

- **`CommandCenter.tsx`** — layout: `KpiStrip` (company), `ExceptionFeed` (the cross-module feed — give it
  prominence, it's the story), `ModuleKpiGrid`, and a copilot entry. Empty/loading/error.
- **`KpiStrip.tsx` / `KpiTile.tsx`** — company KPIs as tiles (value in JetBrains Mono, label, optional
  severity dot).
- **`ModuleKpiGrid.tsx`** — a card per `kpisByModule` entry (module label + its KPIs); the card links to
  `/{module}`.
- **`ExceptionFeed.tsx` / `ExceptionRow.tsx`** — ranked rows: severity dot + title (Archivo) + source
  `sourceLabel` link (→ `url`) + ripple chips (each → `/{rippleModule}`). Critical first.
- **Copilot entry** — a compact "Ask the Axona agent across modules…" affordance that opens the GA.1 pane
  (and optionally seeds a starter question). Reuse the pane/`useAgentChat` from GA.1; don't rebuild chat.

### Severity → token mapping

```ts
const sevDot = { critical: "bg-ink-strong", warn: "bg-accent", ok: "bg-success" }; // ink | lime | green
```

## UX Flow

```
/core  (shell)
 ┌ KpiStrip:  Open exceptions 8●  · Units in build 2 · Fleet uptime 98.4% · Net Q2 $0.53M · Quality 1● ┐
 │
 │ EXCEPTIONS (ranked)
 │  ● NCR-118: drive torque over UCL            quality      → [engineering][procurement][fulfillment]
 │  ● DLV-3312 held at customs (EAR99)          fulfillment  → [legal][finance]
 │  ● SN-2196 watch — thermal anomaly           fleet        → [field-service]
 │  … (click row → source · click chip → that module)
 │
 │ MODULES  ▭ Procurement[Open POs 8 · Awaiting 1⚠]  ▭ Quality[NCRs 1● · Breaches 2⚠]  ▭ Fleet …
 └ [ Ask the Axona agent across modules … ] → opens the GA.1 pane
```

## Edge Cases

| Case | Handling |
|---|---|
| No exceptions (empty org) | feed empty state ("All clear"); KPIs zeroed |
| Exception url is an unbuilt module route | routes; 404 until that screen — expected |
| Severity color | ink/lime/green only; never red |
| Long ripple list | dedupe; cap chips with "+N" |
| Summary fetch fails | error state; shell + pane intact |
| Copilot | reuse GA.1 pane; don't build a second chat |
| Reduced motion | no decorative transitions |

## Out of Scope

- The rollup logic (CMD.1, done) — this only renders it.
- The general agent (GA.1, done) — reuse the pane.
- Live push/SSE refresh of the summary (optional poll only).
- Module screens themselves (their own stories).
- Drill-down analytics per KPI (module screens own detail).

## Dependencies

| Dependency | Status | Blocks What |
|---|---|---|
| CMD.1 `getCoreSummary` / `/api/core/summary` | Done | the data |
| GA.1 agent pane / `useAgentChat` | Done | the copilot |
| DS.1 primitives | Done | the look |
| FND.13 shell | Done | layout + pane |

## Implementation Plan

**Day 1** — `/core` route + `getCoreSummary` fetch + `KpiStrip`/`KpiTile` + `ModuleKpiGrid`.
**Day 2** — `ExceptionFeed`/`ExceptionRow` (severity dots, source links, ripple chips) + ranking.
**Day 3** — copilot entry wired to the GA.1 pane + states + DS.1 fidelity pass.
**Day 4** — a11y + accessibility-review + verify-cmd-2 + manual-checks + commit/push.

## Verification Script

`src/scripts/verify-cmd-2.ts` (static; data render verified in manual-checks):

```ts
// Run: pnpm verify:cmd-2
async function run() {
  let passed = 0, failed = 0;
  const fs = await import("fs");
  const read = (p: string) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  const check = (l: string, ok: boolean) => { console.log(`  ${ok ? "PASS" : "FAIL"} ${l}`); ok ? passed++ : failed++; };
  console.log("\nVerifying CMD.2 — Command Center screen\n");
  const base = "apps/web";

  check("core route + components exist", fs.existsSync(`${base}/app/(shell)/core/page.tsx`) && ["CommandCenter","KpiStrip","ModuleKpiGrid","ExceptionFeed"].every((c) => fs.existsSync(`${base}/components/core/${c}.tsx`)));
  check("renders getCoreSummary", /getCoreSummary/.test(read(`${base}/app/(shell)/core/page.tsx`)));
  check("exception rows link to source + ripples", () => { const t = read(`${base}/components/core/ExceptionFeed.tsx`) + read(`${base}/components/core/ExceptionRow.tsx`); return /url/.test(t) && /ripples/.test(t); });
  check("severity dots ink/lime/green (no red)", () => { const t = read(`${base}/components/core/ExceptionRow.tsx`) + read(`${base}/components/core/KpiTile.tsx`); return /bg-ink-strong/.test(t) && /bg-accent/.test(t) && /bg-success/.test(t) && !/red|#f00|ff0000/i.test(t); });
  check("copilot entry reuses the agent pane (no second chat)", /useAgentChat|AgentPane|openPalette|agent/i.test(read(`${base}/components/core/CommandCenter.tsx`)));
  check("no emoji / no raw hex", () => { const all = fs.readdirSync(`${base}/components/core`).map((f) => read(`${base}/components/core/${f}`)).join("\n"); return !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(all) && !/#[0-9a-fA-F]{3,6}\b/.test(all); });

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else { console.log(`\nFAILED — ${failed} check(s) failed`); process.exit(1); }
}
run();
```

## Append to docs/manual-checks.md

```
## CMD.2 — Command Center screen
**Automated**
- `pnpm verify:cmd-2` — route + components; renders getCoreSummary; exception rows link + ripples; severity ink/lime/green (no red); copilot reuses the pane; token hygiene.
- `pnpm typecheck` clean.

**Manual (./dev.sh, http://localhost:3001/core)**
- [ ] KPI strip + per-module KPI grid + exception feed render from live data.
- [ ] The 8 narrative exceptions appear with severity dots, source links, and ripple chips (NCR-118 → eng/proc/fulfillment, etc.).
- [ ] Click an exception → its module; click a ripple chip → that module.
- [ ] The Axona copilot (right pane) answers a cross-module question over this data.
- [ ] Matches design/prototypes/; no emoji; hairlines; lime = signal (severity ink/lime/green). accessibility-review 0 violations.
```

## Common Mistakes to Avoid

1. **Red severities** — critical = ink, warn = lime, ok = green. No invented reds anywhere.
2. **Rebuilding chat** — the copilot is the GA.1 pane; reuse it, don't build a second chat surface.
3. **Hardcoding the feed** — render from `getCoreSummary`; the numbers/exceptions are live.
4. **Burying the exception feed** — it's the platform-thesis element; give it prominence, not a footnote.
5. **Off-system tiles/rows** — DS.1 primitives; match `design/prototypes/`.
6. **Missing states** — loading/empty/error required.
7. **Dead ripple chips** — each chip links to `/{module}` (404 until that screen is built — expected).

## Cursor Rules for This Story

- `/core` is a static shell route (overrides `[module]`, like `/agents`); server-fetch `getCoreSummary`.
- Render live from CMD.1; severity dots ink/lime/green (no red); exceptions + ripple chips link to sources.
- Copilot = the GA.1 pane (`useAgentChat`); don't build a second chat.
- DS.1 fidelity (`design/prototypes/`); no emoji/raw hex; lime = signal; run accessibility-review.

## Rollback Plan

Revert the CMD.2 commit (`app/(shell)/core/*`, `components/core/*`, verify script). CMD.1's API stays. No
schema or data change. Zero data risk.
