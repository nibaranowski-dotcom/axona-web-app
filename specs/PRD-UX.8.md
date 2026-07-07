# PRD — UX.8 · Loading states (branded loader + shell skeleton)

**Story:** UX.8 — Improve first-load/loading animation: a branded full-screen loader + a shell skeleton.
**Pri/size:** P1 · S–M. **Track:** Platform/polish. **Depth:** CPRD (condensed). Pure UI, no data/schema change.
**Deps:** FND.13 (app shell), the design system. Designs (imported to `design/prototypes/axona-v2/`):
`Loading.dc.html` (full-screen loader) + `Loading Skeleton.dc.html` (in-shell skeleton).

## Problem
Screens/elements currently pop in with a plain grey-bar placeholder (looks unfinished). The v9 designs give a
branded first-load loader and a proper shell skeleton — the goal is to make the **first time a screen/its data
loads** feel polished and on-brand.

## Goals
1. **`<FullScreenLoader />`** 1:1 to `Loading.dc.html` — the axona glyph (spinning ring `ax-spin 9s` + pulsing dots
   `ax-dot 1.4s`), the wordmark rising in, "Waking the agents", and the sliding load bar (`ax-load`). For **initial
   app boot / cold load** (root `app/loading.tsx` and as a Suspense fallback for heavy async boundaries).
2. **`<ScreenSkeleton />`** 1:1 to `Loading Skeleton.dc.html` — a skeleton of the real shell (240px sidebar · 60px
   topbar · main · 360px right pane) with pulsing `.sk`/`.sk-soft` blocks (`sk-pulse 1.4s`). For **per-route loading**
   (`app/(shell)/loading.tsx` and/or per-route `loading.tsx`) so navigating to a screen shows the skeleton, not blank.
3. **Reduced-motion**: honor `prefers-reduced-motion` (both designs already do — no animation, dimmed static state).

## Implementation
- Build the two components 1:1 to the design files (CSS keyframes inline per the design; v2 tokens — the designs use
  `--ink-strong`, `--panel`, `--paper`, `--line`, `--skeleton`; map to our tokens).
- Wire Next.js loading UI: root/shell `loading.tsx` → `<ScreenSkeleton />` (so route transitions show the skeleton
  shell that matches the real layout — **no layout shift** when content streams in); the `<FullScreenLoader />` for
  the pre-shell/cold-boot state (and available as a Suspense fallback).
- Replace the current plain grey-bar loading with these. Skeleton dimensions must align to the real shell so content
  swaps in without a jump.
- `role="status"` / `aria-busy` where appropriate; no emoji; no invented reds.

## Verify + gate (`src/scripts/verify-ux-8.ts`)
1. `<FullScreenLoader />` + `<ScreenSkeleton />` exist and render (the glyph/wordmark/bar; the sidebar+main+pane
   skeleton with `.sk` blocks); reduced-motion path present.
2. A shell/route `loading.tsx` uses `<ScreenSkeleton />`; the cold-load path uses `<FullScreenLoader />`.
3. Skeleton layout matches the shell (240/60/360) so there's no layout shift.
CI gate: install --frozen-lockfile · lint · typecheck · verify:all · **pnpm build** · a11y 0 on the loading states;
commit + push; Actions green.

## Review gate
Stop after UX.8; show: the full-screen loader on cold boot, the shell skeleton on a route transition (matching the
real layout), reduced-motion honored, and verify-ux-8 output.
