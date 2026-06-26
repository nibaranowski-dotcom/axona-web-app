# PRD: SRCH.3 — Command palette (⌘K universal search)

**Status**: Ready for Dev
**Priority**: P0
**Effort**: M (3 days)
**Last Updated**: 2026-06-26
**Backlog Reference**: SRCH.3 (E5 Core · Track: Core) · build-spec §4.2, §6
**Mode**: Full CPRD (the ⌘K palette — must match DS.1 1:1; closes the search loop)

---

## Problem Statement

The launcher search field and the sidebar ⌘K both route to `/search`, which has no UI — the search loop
is half-built. SRCH.1 (index) and SRCH.2 (`/api/search` with scope counts) are done; what's missing is
the Spotlight-style palette that makes search real: type, see live grouped results across every object
type, filter by scope with live counts, and keyboard-navigate to any object. Because Mission Control is
now the full-screen launchpad and module screens live in the shell, the palette must be **global** —
openable with ⌘K from anywhere — not bound to one layout.

## Success Metrics

| Metric | Target |
|---|---|
| ⌘K (and `/`) opens the palette from both the launchpad (`/`) and inside the shell | yes |
| Typing returns live, debounced, grouped results from `/api/search` | < 150ms perceived |
| Scope tabs (All / Agents / Files / …) show live counts from SRCH.2 and filter results | yes |
| ↑↓ navigate · ↵ opens the highlighted hit · Esc closes (returns to where you were) | yes |
| Visually matches DS.1 (`design/prototypes/`) — overlay, field, tabs, rows | 1:1 |
| Tokens only · no emoji · DS.1 primitives | 0 violations |
| Verify + typecheck + a11y | `pnpm verify:srch-3` green, `tsc --noEmit` clean, accessibility-review 0 violations |

## User Stories

- As **any user**, I press ⌘K anywhere and a search palette opens; as I type I get live, grouped results
  across Agents, Modules, Projects, Files, Workflows, Chats.
- As **any user**, I filter by a scope tab (All / Agents / Files / …) and see live counts per scope.
- As **any user**, I press ↑/↓ to move, ↵ to open the highlighted result, Esc to dismiss.
- As **any user**, the launcher search field and the sidebar ⌘K entry both open this same palette.

## Detailed Requirements

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| R1 | A global `CommandPalette` overlay mounted once at the root so ⌘K works from launchpad + shell | P0 | root layout, above both |
| R2 | Open triggers: ⌘K / Ctrl+K, bare `/` (when not typing), the launcher search field, the sidebar ⌘K entry | P0 | unify the FND.13/MC.1 entries onto this |
| R3 | Debounced query (~150ms) → `GET /api/search?q=&scope=`; abort stale requests | P0 | uses SRCH.2 |
| R4 | Scope tabs: All + the 6 types, each with a live count from the response `counts`; selecting filters | P0 | counts ignore scope (SRCH.2 already does this) |
| R5 | Results grouped by type with a type label/glyph, title, subtitle/context | P0 | from `byType` |
| R6 | Keyboard: ↑↓ across the flat result list, ↵ → `router.push(hit.url)` + close, Esc → close, ⌘K toggles | P0 | roving highlight |
| R7 | `/search` route opens the palette (carrying `?q=`) so the existing links + deep-links work | P0 | thin route |
| R8 | States: idle (empty query — prompt/hint), loading, no-results, error | P0 | DoD |
| R9 | Built on DS.1 primitives; matches `design/prototypes/` 1:1; focus trap + a11y roles | P0 | DS.1 fidelity gate |
| R10 | `verify-srch-3.ts` + `docs/manual-checks.md`; `tsc --noEmit` clean | P0 | DoD |

## Acceptance Criteria

- [ ] ⌘K opens the palette on `/` (launchpad) and on a shell route (e.g. `/quality`); Esc closes it and returns focus to where it was.
- [ ] Typing "quality" shows grouped hits (Module, Agents, Project, File) with the per-scope counts on the tabs (All 10, Agents 7, …) matching `/api/search?q=quality`.
- [ ] Selecting the "Agents" scope tab filters to agent hits; counts stay the full live totals.
- [ ] ↑↓ moves a visible highlight across all rows; ↵ navigates to the highlighted `hit.url` and closes; clicking a row does the same.
- [ ] The launcher search field and the sidebar ⌘K entry both open this palette (no more dead `/search` navigation).
- [ ] `/search?q=foo` loads with the palette open and "foo" pre-filled/queried.
- [ ] Idle (no query) shows a hint/empty state; loading shows a subtle indicator; no-results and error states render.
- [ ] Matches DS.1: overlay surface, field, scope tabs, result rows, type glyphs — no emoji, no raw hex, hairlines per DS.1; accessibility-review 0 violations (focus trap, combobox/listbox roles).
- [ ] `pnpm verify:srch-3` green; `tsc --noEmit` clean; committed + pushed.

## Visual Spec (DS.1 — match 1:1)

Build entirely from the DS.1 primitive library and tokens; reference `design/prototypes/` for the exact
look. Use the DS.1 overlay/modal, input, tabs, and list-row primitives — do **not** hand-roll new visual
patterns. Brand invariants apply: single lime signal (the active scope tab / highlighted row accent),
hairlines over shadows (a DS.1 overlay elevation token is fine if DS.1 defines one), JetBrains Mono for
the ⌘K chip / counts / type labels, Archivo for titles, no emoji (type "icons" are DS.1 glyphs or
lettermarks). If DS.1 lacks a palette/overlay primitive, compose it from DS.1's modal + input + tabs and
note the new composite for the design system — don't invent off-system styling.

## Technical Requirements

### Mounting + open state — `apps/web/components/search/CommandPalette.tsx` (client)

- Mounted once in the **root layout** (above both the launchpad and the shell) so it's global.
- Open state in a small store (extend the FND.13 `useUi` Zustand store or a dedicated `useCommandPalette`):
  `open`, `query`, `scope`, `open()/close()/toggle()`.
- Global key handler (replaces/extends the FND.13 hook): ⌘K/Ctrl+K toggles; `/` opens when not typing in
  an input; Esc closes. On open, focus the field; on close, restore prior focus.

### Data hook — `apps/web/lib/use-search.ts` (client)

```ts
// Debounced, abortable search against SRCH.2.
export function useSearch(query: string, scope: SearchScope) {
  const [state, setState] = useState<{ loading: boolean; hits: Hit[]; byType: Record<string,Hit[]>; counts: Record<string,number>; error?: string }>(...);
  useEffect(() => {
    const q = query.trim();
    if (!q) { setState(idle); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setState(s => ({ ...s, loading: true }));
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}&scope=${scope}`, { signal: ctrl.signal });
        const data = await r.json();
        setState({ loading: false, hits: data.hits, byType: data.byType, counts: data.counts });
      } catch (e) { if (!ctrl.signal.aborted) setState(s => ({ ...s, loading: false, error: "Search failed" })); }
    }, 150);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query, scope]);
  return state;
}
```

### Components — `apps/web/components/search/`

- **`CommandPalette.tsx`** — the overlay (DS.1 modal/overlay): a search field (DS.1 input, with the ⌘K
  chip), the `ScopeTabs`, and the `Results` list. Focus trap; `role="dialog" aria-modal`. Closing
  returns focus.
- **`ScopeTabs.tsx`** — All + the 6 `SearchType`s; each tab shows its count from `counts` (`ALL` total,
  per-type); the active tab carries the lime signal. Tabs with 0 may render disabled/dimmed.
- **`Results.tsx`** — grouped sections (or a flat list when a scope is selected); each row: a DS.1 type
  glyph + title (Archivo) + subtitle/context (`ink-muted`); `role="listbox"`, rows `role="option"`,
  `aria-activedescendant` tracks the highlight. ↑↓ moves the highlight across the **flat** order; ↵
  opens `hit.url`.

### Wiring the existing entries (R2)

- Sidebar ⌘K entry (FND.13) and the launcher search field (MC.1): change their behavior from "route to
  `/search`" to "open the palette" (the launcher field can seed the query). Remove the now-dead
  navigate-to-`/search` behavior, or keep `/search` as the deep-link route below.
- `apps/web/app/search/page.tsx` (or `(shell)`-agnostic): a thin client route that, on mount, reads
  `?q=` and opens the palette with that query (so links and deep-links work). It can render over the
  launchpad.

## UX Flow

```
⌘K / "/" / launcher field / sidebar ⌘K
        │
        ▼
 ┌───────────────────────────────────────────┐
 │  [ search field …………………………………  ⌘K ]        │  ← DS.1 overlay (focus-trapped)
 │  [All 10] [Agents 7] [Modules 1] [Files 1] … │  ← ScopeTabs, live counts (SRCH.2)
 │  ───────────────────────────────────────── │
 │  MODULE   Quality                           │  ← grouped rows; ↑↓ highlight (lime)
 │  AGENT    Inspection agent · QA             │
 │  PROJECT  NCR-118 containment               │
 │  FILE     NCR-118 record                    │
 └───────────────────────────────────────────┘
        ↵ → router.push(hit.url) + close
        Esc → close, restore focus
   (debounced 150ms → GET /api/search?q=&scope=, stale requests aborted)
```

## Edge Cases

| Case | Handling |
|---|---|
| Open from a shell route vs launchpad | global mount → identical behavior; Esc restores prior focus in both |
| Fast typing | debounce 150ms + AbortController cancels stale fetches; last response wins |
| Empty/whitespace query | idle state, no fetch (SRCH.2 also short-circuits) |
| No results | "No results for '<q>'" empty state; tabs show 0 |
| API error | inline error row ("Search unavailable"); palette stays open |
| Scope with 0 hits selected | show the empty state for that scope; counts still visible |
| ↑↓ at list ends | clamp (or wrap — pick one; clamp is fine) |
| ⌘K while palette open | toggles closed |
| Result url is an unbuilt route | navigates; the target 404s until its story — expected |
| Mobile/narrow | overlay is responsive (full-width field); acceptable to start desktop-first |

## Out of Scope

- Semantic/vector ranking (FILE.2 + a fusion story) — FTS only, as SRCH.1/2 ship.
- Indexing value-chain/robotics entities beyond the SRCH.1 set (phase-2 search).
- Recent searches / history / favorites (future polish).
- Inline result previews or actions (open-in-place) — ↵ navigates for now.

## Dependencies

| Dependency | Status | Blocks What |
|---|---|---|
| SRCH.2 `/api/search` + counts | Done | the data |
| DS.1 primitives + tokens | Done | the look (overlay/input/tabs/rows) |
| FND.13 shell + ⌘K hook + `useUi` | Done | the entries to unify |
| MC.1 launcher search field | Done | one of the open triggers |

## Implementation Plan

**Day 1** — palette store + global mount + key handling (⌘K/`/`/Esc) + `useSearch` hook; open/close from both layouts.
**Day 2** — `CommandPalette` + `ScopeTabs` (counts) + `Results` (grouped, keyboard highlight, ↵ navigate) on DS.1 primitives; wire the sidebar + launcher entries; `/search?q=` route.
**Day 3** — states (idle/loading/empty/error) + a11y (focus trap, roles, focus restore) + accessibility-review + verify-srch-3 + manual-checks + commit/push.

## Verification Script

`src/scripts/verify-srch-3.ts` (static — interaction in manual-checks):

```ts
// Run: pnpm verify:srch-3
async function run() {
  let passed = 0, failed = 0;
  const fs = await import("fs");
  const read = (p: string) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  const check = (l: string, ok: boolean) => { console.log(`  ${ok ? "PASS" : "FAIL"} ${l}`); ok ? passed++ : failed++; };
  console.log("\nVerifying SRCH.3 — command palette\n");
  const base = "apps/web";

  for (const c of ["CommandPalette", "ScopeTabs", "Results"])
    check(`component search/${c}.tsx`, fs.existsSync(`${base}/components/search/${c}.tsx`));
  check("useSearch debounced + abortable", () => { const t = read(`${base}/lib/use-search.ts`); return /AbortController/.test(t) && /setTimeout/.test(t); });
  check("palette mounted at root (global)", /CommandPalette/.test(read(`${base}/app/layout.tsx`)) || /CommandPalette/.test(read(`${base}/app/(shell)/layout.tsx`)));
  check("⌘K / Ctrl+K open handler", () => /metaKey|ctrlKey/.test(read(`${base}/components/search/CommandPalette.tsx`)) && /["']k["']/i.test(read(`${base}/components/search/CommandPalette.tsx`)));
  check("hits /api/search", () => /\/api\/search/.test(read(`${base}/lib/use-search.ts`)));
  check("scope tabs use counts", () => /counts/.test(read(`${base}/components/search/ScopeTabs.tsx`)));
  check("a11y roles present", () => { const t = read(`${base}/components/search/CommandPalette.tsx`) + read(`${base}/components/search/Results.tsx`); return /role="dialog"/.test(t) && /role="listbox"|role='listbox'/.test(t); });
  const all = fs.readdirSync(`${base}/components/search`).map((f) => read(`${base}/components/search/${f}`)).join("\n");
  check("no emoji / no raw hex in palette", !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(all) && !/#[0-9a-fA-F]{3,6}\b/.test(all));

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else { console.log(`\nFAILED — ${failed} check(s) failed`); process.exit(1); }
}
run();
```

## Append to docs/manual-checks.md

```
## SRCH.3 — Command palette (⌘K)
**Automated**
- `pnpm verify:srch-3` — components, global mount, key handler, useSearch (debounce/abort), scope counts, a11y roles, token hygiene.
- `pnpm typecheck` clean.

**Manual (./dev.sh, http://localhost:3001)**
- [ ] ⌘K opens the palette on / (launchpad) AND on a shell route; Esc closes + restores focus.
- [ ] Type "quality" → grouped hits; scope tabs show All 10 / Agents 7 / Modules 1 / … matching /api/search.
- [ ] Click the Agents tab → filters to agents; ↑↓ highlights; ↵ opens the hit (navigates); click does the same.
- [ ] Launcher search field + sidebar ⌘K both open THIS palette (no dead /search nav).
- [ ] /search?q=osaka opens with the palette and the query pre-filled.
- [ ] Matches design/prototypes/ (overlay, field, tabs, rows); no emoji; hairlines; lime only as the active signal.
- [ ] accessibility-review: focus trap, combobox/listbox roles, AA contrast — 0 violations.
```

## Common Mistakes to Avoid

1. **Mounting the palette inside the shell only** — Mission Control is the launchpad outside the shell; mount globally at the root or ⌘K won't work on `/`.
2. **Not aborting stale fetches** — fast typing races responses; use `AbortController` so the last query wins.
3. **Re-querying for counts** — the counts come back in the same `/api/search` response (SRCH.2); don't make a second call.
4. **Off-system styling** — build from DS.1 primitives; if a palette primitive is missing, compose from DS.1 modal+input+tabs and register it, don't invent.
5. **Red highlight / emoji type icons** — highlight uses the lime signal; type icons are DS.1 glyphs/lettermarks; no emoji, no red.
6. **Losing focus on close** — capture the previously focused element and restore it on Esc/close for keyboard users.
7. **Leaving the dead `/search` navigation** — repoint the sidebar + launcher entries to open the palette; keep `/search` only as the deep-link route.

## Cursor Rules for This Story

- Palette is global (root mount); ⌘K/`/`/Esc work from launchpad and shell; focus is trapped then restored.
- Data via `/api/search` (SRCH.2) only; debounced + abortable; counts from the same response.
- Built on DS.1 primitives/tokens; matches `design/prototypes/`; no emoji, no raw hex, hairlines; lime = active signal.
- a11y: `role="dialog"` + combobox/listbox semantics; keyboard-complete; run accessibility-review.
- Repoint the FND.13 sidebar ⌘K + MC.1 launcher field to open the palette; `/search` becomes the deep-link route.

## Rollback Plan

Revert the SRCH.3 commit (`components/search/*`, `lib/use-search.ts`, the root-mount + store changes, the
`/search` route, the sidebar/launcher rewiring, verify script). The sidebar/launcher revert to routing to
`/search` (or a placeholder). No schema or data changes. Zero data risk.
