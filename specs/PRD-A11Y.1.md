# PRD — A11Y.1 · Accessibility cleanup (contrast token + landmarks/lang)

**Story:** A11Y.1 — Close the remaining WCAG 2.1 AA gaps surfaced by the route scans.
**Pri/size:** P1 · S. **Track:** Platform/polish. **Depth:** CPRD (condensed). Mostly token + markup; no data/schema change.
**Deps:** the app shell (FND.13), the v2 token layer (`design/tokens` / Tailwind CSS-var tokens), the `/search` Launcher
(SRCH.*), root layout. No new deps.

## Problem (two independent gaps)
1. **Contrast — `text-ink-faint`.** The faint ink token (`#9a9a90`) renders small text at **~2.84:1** on paper
   (`#ffffff`) and panel (`#f4f3ef`) — below WCAG **AA 4.5:1** for normal-size text. Used widely for meta/labels.
2. **Structure — `/search` route scan (4 findings, pre-existing, surfaced by SRCH.6).** The root `<html>` is missing
   `lang`; the Launcher/loader markup lacks a `<main>` landmark, an `<h1>`, and a skip/bypass mechanism →
   `html-has-lang`, `landmark-one-main`, `page-has-heading-one`, `bypass`.

## Goals
1. **Fix `text-ink-faint` at the token level** so every existing usage passes AA (≥4.5:1) on **both** `#ffffff` and
   `#f4f3ef` — darken to the lightest warm-grey that clears 4.5:1 on both backgrounds (stay in the brand's warm-grey
   family; do **not** introduce a new token or a raw hex at call sites). Compute + verify the exact value against both
   backgrounds; keep it as close to the current tone as the 4.5:1 floor allows. (Brand invariants still win — single
   lime accent, warm greys, no invented colors.)
   - If any specific usage is genuinely decorative / large-text-only and darkening hurts it, that's the exception —
     but the default is: one darker token value, all call sites inherit it. Flag any exception rather than forking the token.
2. **Root `<html lang="en">`** in the root layout.
3. **`/search` Launcher structure:** wrap the primary content in a `<main>` landmark, add a page `<h1>` (visible or
   `sr-only` per the design — the Launcher has no visible H1 today, so `sr-only` "Search" is fine), and ensure a
   skip-to-content/bypass path exists (a skip link in the shell, or the `<main>` target). Match the design visually —
   these are semantic/SR-only additions, no visible layout change.

## Non-goals
Full-app a11y audit / keyboard-trap sweep → later. Focus-visible restyle → later. Only the two gaps above.

## Implementation notes
- One token edit (the `--ink-faint` / `text-ink-faint` CSS var) — grep confirms all call sites read the token, none
  hardcode `#9a9a90`. If any hardcode exists, repoint it to the token.
- Root layout: `<html lang="en">`. If a skip link is added, put it in the shell layout (first focusable, `sr-only`
  until focused), targeting `#main` / the `<main>`.
- Verify the darkened value doesn't regress the "faint" intent visually on a couple of screens (Core stat-strip meta,
  a table's mono sub-labels) — it should read quieter than `text-ink` but now legible.

## Verify + gate (`src/scripts/verify-a11y-1.ts`)
1. `text-ink-faint` computes to ≥4.5:1 against both `#ffffff` and `#f4f3ef` (assert the contrast ratios in the script).
2. Root document has `lang`; the `/search` Launcher exposes a `<main>` landmark + an `<h1>` (visible or sr-only) + a
   bypass path.
CI gate: install --frozen-lockfile · lint · typecheck · verify:all · **pnpm build** · **a11y 0 on `/search`, `/login`,
`/core`** (representative: public loader route + auth route + a dense shell route); commit + push; Actions green.

## Review gate
Stop after A11Y.1; show: the old vs new `text-ink-faint` contrast ratios (both backgrounds), the `/search` scan now at
0 findings, and verify-a11y-1 output.
