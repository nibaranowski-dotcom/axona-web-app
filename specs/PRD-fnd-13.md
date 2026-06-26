# PRD: FND.13 — App shell (sidebar · agent pane · trace console)

**Status**: Ready for Dev
**Priority**: P0
**Effort**: L (4–5 days)
**Last Updated**: 2026-06-26
**Backlog Reference**: FND.13 (E0 Foundation · Track: Foundation)
**Mode**: Full CPRD (sets the visual bar every screen inherits — Linear/Harvey-class)

---

## Problem Statement

Every screen from MC.1 onward lives inside one shell — a left sidebar with grouped module nav, an
optional right agent pane, and a dark agent-trace console on module screens (build-spec §4 intro, §7).
Without the shell, each screen would reinvent layout, nav, and the agent surface, and the product would
drift from the brand. This story builds the shell once, to the design bar (Archivo + JetBrains Mono,
paper field, single lime signal, hairlines over shadows, no emoji), reading the 22 seeded modules for
nav, so the next stories just drop content into a `<main>` slot and a consistent agent surface.

## Success Metrics

| Metric | Target |
|---|---|
| Shell renders at `/` on 3001 with the 22 seeded modules grouped CORE/VALUE CHAIN/ROBOTICS/BACK OFFICE | yes |
| Active route highlighted with the lime signal | yes |
| Agent pane resizes (drag) and collapses to a 52px rail; state persists across reload | yes |
| Keyboard: `⌘K` affordance focuses the search entry; visible focus rings; nav is tab-navigable | yes |
| Tokens only — no raw hex, no emoji, no drop shadows | 0 violations |
| Empty/loading/error states for the nav data fetch | all three exist |
| Verify + typecheck | `pnpm verify:fnd-13` green, `tsc --noEmit` clean |

## User Stories

- As **any user**, I see all modules grouped Core / Value chain / Robotics / Back office in a left
  sidebar, and clicking one routes to it with the active item highlighted.
- As **any user**, I can press `⌘K` (or click the search field) to focus universal search (the palette
  itself is SRCH.3; here it's the entry affordance + keyboard hook).
- As a **power user**, I can drag the agent pane wider/narrower and collapse it to a thin rail; my
  choice persists when I reload.
- As a **keyboard user**, I can tab through nav and controls with visible focus rings.

## Detailed Requirements

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| R1 | `(shell)/layout.tsx` — sidebar + `<main>` content slot + right agent-pane slot | P0 | App Router route group |
| R2 | `Sidebar` — wordmark, `⌘K` search entry, nav grouped by `ModuleGroup`, collapsible sections, active highlight | P0 | reads modules from DB |
| R3 | `NavSection` — a collapsible group (CORE/VALUE CHAIN/ROBOTICS/BACK OFFICE) with its module rows | P0 | persisted open/closed |
| R4 | `AgentPane` — resizable via drag, collapsible to a 52px `AgentRail`; width + collapsed persisted | P0 | Zustand UI store + localStorage |
| R5 | `AgentRail` — the 52px collapsed state (expand affordance) | P0 | |
| R6 | `TraceConsole` — dark block rendering trace lines; static placeholder lines now, SSE in ART.5 | P0 | dark surface, JetBrains Mono |
| R7 | Nav data: server component reads the 22 modules (global table) ordered by `orderIndex`, grouped | P0 | empty/loading/error states |
| R8 | `⌘K` keyboard hook focuses the search entry (palette is SRCH.3) | P0 | also `/` to focus, Esc to blur |
| R9 | Stubbed current user/session until AUTH.1 (demo ADMIN from seed) | P0 | clearly marked TODO → AUTH.1 |
| R10 | Tokens only, no emoji, hairlines not shadows; AgentGlyph used for agent affordances | P0 | design.md |
| R11 | `verify-fnd-13.ts` + `docs/manual-checks.md` entry; `tsc --noEmit` clean | P0 | DoD |

## Acceptance Criteria

- [ ] `/` renders the shell on 3001: sidebar (wordmark + ⌘K + 4 nav groups with the 22 modules) and a content area.
- [ ] Nav groups are collapsible; their open/closed state persists across reload.
- [ ] The active route's nav item shows the lime signal (left bar or text accent), nothing else "all lime."
- [ ] Agent pane: drag handle resizes between a min (~280px) and max (~520px); a control collapses it to a 52px rail; width and collapsed state persist (localStorage).
- [ ] `TraceConsole` renders as a dark block with monospace trace lines (placeholder content) and is collapsible.
- [ ] `⌘K` (and `/`) focuses the search entry; Esc blurs; visible focus rings on all interactive elements; full keyboard tab order.
- [ ] Nav fetch shows a skeleton while loading, an empty state if zero modules, and an error state on failure.
- [ ] No raw hex in components, no emoji, no drop shadows (hairlines only); fonts are Archivo (UI) + JetBrains Mono (labels/trace).
- [ ] `pnpm verify:fnd-13` green; `pnpm typecheck` clean; committed and pushed.

## Technical Requirements

### Route group + layout — `apps/web/app/(shell)/layout.tsx`

```tsx
import type { ReactNode } from "react";
import { Sidebar } from "@/components/shell/Sidebar";
import { AgentPane } from "@/components/shell/AgentPane";
import { getNavModules } from "@/lib/nav";

export default async function ShellLayout({ children }: { children: ReactNode }) {
  const groups = await getNavModules(); // server fetch, grouped + ordered
  return (
    <div className="grid h-dvh grid-cols-[auto_1fr_auto] bg-paper text-ink">
      <Sidebar groups={groups} />
      <main className="min-w-0 overflow-y-auto">{children}</main>
      <AgentPane />
    </div>
  );
}
```

### Nav data — `apps/web/lib/nav.ts`

```ts
import { prisma } from "@axona/db";

const GROUP_ORDER = ["CORE", "VALUE_CHAIN", "ROBOTICS", "BACK_OFFICE"] as const;
const GROUP_LABEL: Record<string, string> = {
  CORE: "Core", VALUE_CHAIN: "Value chain", ROBOTICS: "Robotics", BACK_OFFICE: "Back office",
};

export interface NavModule { key: string; name: string; href: string; }
export interface NavGroup { group: string; label: string; modules: NavModule[]; }

/** Modules are a GLOBAL catalog (no orgId) — read with the bare client. */
export async function getNavModules(): Promise<NavGroup[]> {
  const rows = await prisma.module.findMany({ orderBy: [{ group: "asc" }, { orderIndex: "asc" }] });
  return GROUP_ORDER.map((g) => ({
    group: g, label: GROUP_LABEL[g],
    modules: rows.filter((m) => m.group === g).map((m) => ({ key: m.key, name: m.name, href: `/${m.key}` })),
  })).filter((grp) => grp.modules.length > 0);
}
```

The route slug convention: `Module.key` is the route (`/core`, `/procurement`, …). Mission Control is
`/` (special-cased), Search is `/search`.

### UI store (Zustand) — `apps/web/lib/ui-store.ts`

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  agentPaneWidth: number;     // px
  agentPaneCollapsed: boolean;
  navOpen: Record<string, boolean>; // group -> open?
  setAgentPaneWidth: (w: number) => void;
  toggleAgentPane: () => void;
  toggleNav: (group: string) => void;
}

const MIN = 280, MAX = 520, RAIL = 52;

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      agentPaneWidth: 340,
      agentPaneCollapsed: false,
      navOpen: { CORE: true, VALUE_CHAIN: true, ROBOTICS: true, BACK_OFFICE: true },
      setAgentPaneWidth: (w) => set({ agentPaneWidth: Math.min(Math.max(w, MIN), MAX) }),
      toggleAgentPane: () => set((s) => ({ agentPaneCollapsed: !s.agentPaneCollapsed })),
      toggleNav: (group) => set((s) => ({ navOpen: { ...s.navOpen, [group]: !s.navOpen[group] } })),
    }),
    { name: "axona-ui" } // localStorage; SSR-safe (see Edge Cases)
  )
);
export const RAIL_WIDTH = RAIL;
```

### Components — `apps/web/components/shell/`

- **`Sidebar.tsx`** (client): fixed-width column (~240px) on `--panel`. Top: wordmark (Archivo, no
  emoji). Below: the `⌘K` search entry (a button styled as a field showing "Search" + a `⌘K` chip in
  JetBrains Mono). Then the four `NavSection`s. Hairline right border (`border-line`), not a shadow.
- **`NavSection.tsx`** (client): group label (uppercase, `text-ink-faint`, JetBrains Mono, small) with a
  collapse chevron bound to `useUi().navOpen[group]`; renders `NavModule` rows. Active row (matches
  `usePathname()`) gets the lime signal — a 2px left bar in `--accent` + `text-ink-strong`; inactive
  rows `text-ink-muted` hover `bg-panel-2`.
- **`AgentPane.tsx`** (client): right column. When `agentPaneCollapsed`, render `AgentRail` (52px). Else
  render the pane at `agentPaneWidth` with a left drag handle (`onPointerDown` → track `pointermove` →
  `setAgentPaneWidth(viewportRight - clientX)`), a header ("Axona agent" + AgentGlyph + collapse
  button), and a body placeholder ("Ask across modules…" — the real chat is GA.1/ART.4). Hairline left
  border.
- **`AgentRail.tsx`** (client): 52px rail with an expand button + a vertical AgentGlyph; click →
  `toggleAgentPane()`.
- **`TraceConsole.tsx`** (client): a dark block (`bg-ink-strong`, `text-on-dark-mut`) rendering an array
  of trace lines in JetBrains Mono (scan → correlate → draft → policy-check → result), with a collapse
  toggle. Props accept `lines: {ts?: string; text: string}[]`; ship 4–6 placeholder lines. SSE wiring is
  ART.5 — leave a `// TODO ART.5` where the stream attaches.
- Reuse **`AgentGlyph`** from FND.15 if present; if FND.15 hasn't landed, render a static 12-dot ring
  inline and leave a note to swap to the shared component.

### Keyboard — `⌘K` / `/` hook

A small `useGlobalKeys()` hook (client, mounted in `Sidebar`): `keydown` listener; `(e.metaKey||e.ctrlKey) && e.key==="k"`
or bare `/` (when not typing in an input) → `preventDefault()` + focus the search entry; `Escape` → blur.
The palette navigation itself is SRCH.3 — here the entry just focuses (and may route to `/search`).

### Stubbed session (until AUTH.1) — `apps/web/lib/session.ts`

```ts
import { prisma } from "@axona/db";
// TODO AUTH.1: replace with the real Auth.js session.
export async function getCurrentUser() {
  // demo ADMIN from the FND.12 seed; lets the shell + screens render pre-auth.
  return prisma.user.findFirst({ where: { role: "ADMIN" } });
}
```

Nav shows all modules to all roles (read); action-level RBAC is per-screen later (RBAC.2/3). Note this.

## UX Flow

```
/(shell)/layout (server) ── getNavModules() ──► 22 modules grouped
   │
   ├─ Sidebar (client)
   │     wordmark
   │     [ Search            ⌘K ]   ← focus on ⌘K / click; routes to /search (SRCH.3)
   │     ▸ CORE            (collapsible, persisted)
   │         · Command Center  ← active = lime left-bar + ink-strong
   │         · Agents · Workflows · Projects · Machines …
   │     ▸ VALUE CHAIN · ROBOTICS · BACK OFFICE
   │
   ├─ <main>  ← screens render here (MC.1, /core, /procurement…)
   │
   └─ AgentPane (client)
         collapsed? ─ yes ─► AgentRail (52px, expand)
                    └ no ──► [drag handle] header(AgentGlyph) + body placeholder
                              width persisted in localStorage
   (module screens additionally render <TraceConsole/> — dark, monospace, collapsible)
```

## Edge Cases

| Case | Handling |
|---|---|
| Zustand `persist` + SSR hydration mismatch | gate persisted UI reads behind a mounted flag (render defaults on first paint, then hydrate) to avoid hydration errors |
| Zero modules (un-seeded DB) | nav shows an empty state ("No modules — run the seed"), not a broken layout |
| Nav fetch fails | error state in the sidebar ("Couldn't load navigation") with the rest of the shell intact |
| Drag below min / above max | clamp to [280, 520]; rail is a separate collapsed state, not width 0 |
| `⌘K` while typing in an input | ignore bare `/`; still honor ⌘K/Ctrl+K |
| No authenticated user yet | `getCurrentUser()` stub returns the seeded ADMIN; clearly marked TODO → AUTH.1 |
| Very narrow viewport | sidebar collapses to icon-only or an overlay (define a breakpoint; acceptable to start with a fixed min-width + horizontal scroll guard) |
| prefers-reduced-motion | pane/nav transitions respect it (no animated collapse) |

## Out of Scope

- The search palette UI and results (SRCH.3) — here only the entry + keyboard focus.
- Real auth/session (AUTH.1) — stubbed.
- The agent chat thread + SSE streaming (GA.1 / ART.4 / ART.5) — pane + console are placeholders.
- Per-screen content (MC.1 and module screens).
- Action-level RBAC gating (RBAC.2/3) — nav is read-all.

## Dependencies

| Dependency | Status | Blocks What |
|---|---|---|
| FND.2 tokens + fonts | Done | all shell styling |
| FND.12 seeded modules | Done | nav data |
| FND.11 `prisma` client | Done | `getNavModules` |
| FND.15 AgentGlyph/primitives | Parallel | reuse if present, else inline + TODO |

## Implementation Plan

**Day 1** — route group + layout grid + `getNavModules` + nav empty/loading/error.
**Day 2** — Sidebar + NavSection (collapsible, persisted, active highlight) + wordmark + search entry.
**Day 3** — UI store + AgentPane drag-resize + AgentRail collapse + persistence + hydration-safe gate.
**Day 4** — TraceConsole + `⌘K`/`/` keyboard hook + AgentGlyph wiring + a11y (focus rings, tab order, reduced-motion).
**Day 5** — verify-fnd-13 + manual-checks + design-critique/accessibility-review pass + commit/push.

## Verification Script

`src/scripts/verify-fnd-13.ts` (static — UI behavior is in manual-checks):

```ts
// Run: pnpm verify:fnd-13
async function run() {
  let passed = 0, failed = 0;
  const fs = await import("fs");
  const read = (p: string) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  const check = (label: string, ok: boolean) => { console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`); ok ? passed++ : failed++; };
  console.log("\nVerifying FND.13 — app shell\n");

  const base = "apps/web";
  check("shell layout exists", fs.existsSync(`${base}/app/(shell)/layout.tsx`));
  for (const c of ["Sidebar", "NavSection", "AgentPane", "AgentRail", "TraceConsole"])
    check(`component ${c}.tsx`, fs.existsSync(`${base}/components/shell/${c}.tsx`));
  check("nav data helper", /getNavModules/.test(read(`${base}/lib/nav.ts`)));
  check("ui store (zustand persist)", /persist\(/.test(read(`${base}/lib/ui-store.ts`)));
  check("session stub flags AUTH.1", /AUTH\.1/.test(read(`${base}/lib/session.ts`)));

  // Token hygiene: no raw hex, no emoji in shell components
  const shellFiles = fs.readdirSync(`${base}/components/shell`).map((f) => read(`${base}/components/shell/${f}`)).join("\n");
  check("no raw hex in shell components", !/#[0-9a-fA-F]{3,6}\b/.test(shellFiles));
  check("no emoji in shell components", !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(shellFiles));
  check("TraceConsole leaves SSE hook for ART.5", /ART\.5/.test(read(`${base}/components/shell/TraceConsole.tsx`)));
  check("keyboard hook handles cmd/ctrl K", /key\s*===\s*["']k["']/i.test(shellFiles));

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else { console.log(`\nFAILED — ${failed} check(s) failed`); process.exit(1); }
}
run();
```

## Append to docs/manual-checks.md

```
## FND.13 — App shell
**Automated**
- `pnpm verify:fnd-13` — shell layout + 5 components + nav helper + ui store + token hygiene.
- `pnpm typecheck` clean.

**Manual (pnpm --filter @axona/web dev, open http://localhost:3001)**
- [ ] Sidebar shows wordmark, a ⌘K search entry, and 4 groups (Core/Value chain/Robotics/Back office) with the 22 modules.
- [ ] Collapsing a nav group and reloading keeps it collapsed (persisted).
- [ ] The active route's nav item shows the lime signal; nothing else reads "all lime."
- [ ] Drag the agent pane wider/narrower (clamped); collapse it to the 52px rail; reload keeps the size/collapsed state.
- [ ] TraceConsole renders as a dark monospace block and collapses.
- [ ] ⌘K (and "/") focuses the search entry; Esc blurs; visible focus rings; tab order is sane.
- [ ] Fonts: Archivo UI, JetBrains Mono for labels/trace; no emoji; hairlines (no drop shadows).
- [ ] Run design-critique + accessibility-review skills — AA contrast + focus order pass.
```

## Common Mistakes to Avoid

1. **Zustand `persist` causing hydration mismatch** — render store-backed UI only after a `mounted` flag flips, or the server/client first paint will differ and React will error.
2. **Hardcoding the nav list** — read the 22 modules from the DB so it stays in sync with the seed; don't duplicate the list in code.
3. **Lime everywhere** — the accent is the active-item signal only; inactive nav is `ink-muted`. If a reviewer says "all lime," pull back.
4. **Drop shadows for elevation** — use hairline borders + surface steps (`panel`/`panel-2`), never `box-shadow`.
5. **Emoji as nav icons** — banned. Use the AgentGlyph, simple lettermarks, or restrained line marks.
6. **Building the search palette here** — out of scope; ⌘K only focuses the entry. The palette is SRCH.3.
7. **Forgetting empty/loading/error on the nav fetch** — all three are required by the DoD.

## Cursor Rules for This Story

- Tokens only (semantic classes from FND.2); zero raw hex in shell components; no emoji; hairlines not shadows.
- Nav reads `Module` from the DB (global, bare `prisma`); slugs come from `Module.key`.
- UI state (pane width/collapsed, nav open) lives in the Zustand `persist` store, hydration-safe.
- `getCurrentUser()` is a stub clearly marked `TODO AUTH.1`; nav is read-all (action RBAC is later).
- Agent pane min 280 / max 520 / rail 52; TraceConsole leaves a `// TODO ART.5` SSE attach point.
- Run design-critique + accessibility-review before calling it done.

## Rollback Plan

Revert the FND.13 commit (the `(shell)` route group, `components/shell/*`, `lib/{nav,ui-store,session}.ts`,
verify script). No schema or data changes. The placeholder `app/page.tsx` from FND.2 remains valid if the
shell layout is removed. Zero data risk.
