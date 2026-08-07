# PRD — SIDEBAR.2 · Cloudflare-style app-shell navigation

**Story:** SIDEBAR.2 — evolve the shared app-shell sidebar into the Cloudflare-style navigation of record:
labelled sections, one-active-row state, **64px rail collapse persisted per user**, **chevron drill-in** on
expandable rows, and the global **⌘K** search affordance. Replaces the current flat nav header + list across
every in-shell screen. Builds on SIDEBAR.1 (header co-brand) and the existing `Sidebar.tsx` / `NavSection.tsx`.
**Screen (1:1 source):** `design/prototypes/axona-v2/Sidebar Nav.dc.html` (v10 export — shows the expanded
264px nav and the collapsed 64px rail side by side).
**Type:** shared shell component (240px sidebar / 64px rail) — **no route**; applies to every in-shell screen
(all modules, Core, PLM, Settings). **Pri/size:** P1 · M. **Track:** UX/shell.
**Deps:** SIDEBAR.1 (workspace-switcher header), `components/shell/Sidebar.tsx`, `components/shell/NavSection.tsx`,
`components/shell/module-icons.tsx`, SRCH.3/SRCH.4 (⌘K palette the search field opens), a per-user UI-prefs store
(additive on `User` or a `UserPref` row — via `migrate dev`, never `db push`).

## How to read this (CLAUDE.md rule)

Wire-up defers to the design. `Sidebar Nav.dc.html` is the sole truth for layout, spacing, the section
structure, the active/hover treatment, the chevron placement, the count-badge style, and the collapsed rail.
This PRD adds only **data · behavior · verify · DoD**. Implement the file 1:1; the design wins on conflict
(flag it before diverging).

## Anatomy (top → bottom, from the design + `axona-sidebar-nav-note.md`)
1. **Workspace switcher** — SIDEBAR.1's header (Axona/customer mark + workspace name + chevron → org menu).
2. **Quick search** — full-width field, magnifier, `⌘K` hint; clicking it (or ⌘K anywhere) opens the palette
   (SRCH.4). The field is the visible affordance for the global binding.
3. **Labelled sections** — UPPERCASE MONO group labels; keep Axona's real groups: **Core · Value chain ·
   Robotics · Back office** (the first group may be unlabelled). Section labels are optional per group.
4. **Nav rows** — Lucide line-icon (~1.7 stroke, `currentColor`) + label + **right chevron on expandable
   items** (drill-in) + optional lime count badge. Leaf rows have no chevron.
5. **Account row** (pinned bottom) — avatar + name/role + the collapse toggle (panel-with-line glyph).

## Behavior (implement all, 1:1 to the design)
- **Active state:** the current route's row gets `--panel` fill, ink label + ink icon; siblings are muted-ink
  label + faint icon (`--ink-faint`), hover row → `--panel` + `--ink-muted` icon. **Exactly one active row.**
- **Section groups collapse** (`<details>`): a group containing the active row stays open on load; **persist
  open/closed per user**.
- **Rail collapse:** the account-row toggle switches expanded (264px) ↔ rail (64px). Rail = icons only,
  centered; section breaks become short hairline dividers; the active tile persists; hover shows the row name
  as a tooltip. **Persist the choice per user.**
- **Chevron = drill-in, not accordion:** a chevron row **navigates to that module's landing screen** (which
  owns its own sub-nav/tabs). Do NOT nest a second tree in the sidebar.
- **Global ⌘K:** bound on every app screen; focuses/opens the palette (SRCH.4). The search field is the
  visible affordance. Motion ~0.12s on background/icon; honor `prefers-reduced-motion`.

## Data (no new domain data — UI prefs only)
- Per-user UI prefs: `sidebarCollapsed: boolean` and `sidebarGroupState: Record<groupKey, boolean>` (open/closed
  per section). Store on the user (additive nullable column or a `UserPref` k/v row); org-scoped by `orgId`
  where the store is tenant-partitioned. SSR the persisted state so the sidebar renders in its saved shape with
  no flash. Route→group→active-row mapping lives in the nav config (extend `module-icons.tsx` / the nav map),
  not hard-coded per screen.

## Verify + gate
- `verify-sidebar-2.ts`: (1) collapsed + per-group state round-trip through the prefs store for a user and are
  org-scoped; (2) the nav map resolves exactly one active row for each in-shell route; (3) every chevron row's
  target is a real module landing route (no dead chevron); (4) rail config exposes a tooltip name per row.
  Self-cleaning. Add a `docs/manual-checks.md` entry (expand/collapse persists across reload; rail persists;
  active row correct on deep-link; keyboard-tab through rows shows visible focus).
- **a11y:** the sidebar is keyboard-operable (logical tab order, visible focus, rail tooltips have accessible
  names); add its routes to `a11y-routes.ts` if a new shell wrapper renders. Contrast: muted/faint label tokens
  must clear AA (reuse the A11Y.3-safe mono/ink tokens — `--ink-faint` fails AA on `--panel-2`; use the safe
  token for any text-bearing label).

## DoD
The app shell's sidebar matches `Sidebar Nav.dc.html` in both expanded and rail states; active state, per-group
collapse + rail collapse **persisted per user**, chevron drill-in to module landings, global ⌘K to the palette;
v2 tokens only (no raw hex); `tsc --noEmit` clean; `verify:all` green; a11y AA on the shell. Would it feel at
home in Linear/Cloudflare's shell? If not, it isn't done.
