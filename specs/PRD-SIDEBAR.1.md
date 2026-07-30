# PRD — SIDEBAR.1 · Sidebar header co-branding (Axona + customer logo)

**Story:** SIDEBAR.1 — refactor the shared sidebar **header** into a deliberate co-brand: the customer owns the
workspace, Axona is present as the trusted platform marker; degrade cleanly to the 60px collapsed rail.
**Screen (1:1 source):** `design/prototypes/axona-v2/Sidebar Header.dc.html` (from the sidebar design export).
**Type:** shared shell component (top region of the 240px sidebar / 60px rail) — **no route**; applies to every
in-shell screen (all modules, Core, PLM, Settings). **Pri/size:** P1 · S–M. **Track:** UX/shell. **Deps:**
`components/shell/Sidebar.tsx` (already takes `org?: { name, logoUrl }` — PROSPECT.2), `Org.logoKey` + FILE.1
blob resolution, UX.7 identity menu, UX.14 collapsed rail.

## How to read this (CLAUDE.md rule)

Wire-up defers to the design. `Sidebar Header.dc.html` is the sole truth for layout, spacing, the switcher row,
the demoted Axona mark, the `ON AXONA` microlabel, and the collapsed treatment. This PRD adds only **data ·
behavior · verify · DoD**. Implement the file 1:1; design wins on conflict (flag it).

## Data (tenant branding — org-level)

- `logo_url` (nullable, resolved from `Org.logoKey` → FILE.1 blob), `display_name` (= `Org.name`), and an
  **optional `logo_variant`** (additive nullable if the design uses it; via `migrate dev`, never `db push`).
- **The presence of `logo_url` is the single switch between State A and State B.** Real marques are **injected at
  runtime**; never committed to the design system or the repo (the design file uses a hatch placeholder).

## States (implement all three, 1:1 to the design)

- **State A · Axona-only** (no `logo_url`): the Axona asymmetric square sits in the switcher slot with the name
  "Axona". **No `ON AXONA` microlabel** (redundant — the platform is the workspace).
- **State B · Co-branded** (`logo_url` set): the customer logo tile (24px, hairline, neutral paper) + customer
  name occupy the switcher slot; **Axona drops below a single hairline** as a 9px asymmetric square + `ON AXONA`
  in UPPERCASE mono.
- **Collapsed rail (60px):** co-branded → customer tile at 28px leads · short hairline · Axona square persists at
  13px · expand toggle keeps its own row. Axona-only → just the Axona square.

## Behavior (spec explicitly — a bug caught in review)

- **Two INDEPENDENT flags, do not collapse into one boolean:**
  1. whether the **customer-logo tile** renders (driven by `logo_url` presence), and
  2. whether the **`ON AXONA` microlabel** renders.
  Toggling the microlabel off must **not** remove the logo; toggling co-branding off must switch the name to
  "Axona" **and** the mark. Model as two separate props/booleans.
- **Logo hygiene — enforced in code, not by convention:** `max-height` 24px expanded / 28px tile in rail ·
  `object-contain` · rendered on a neutral **paper** tile with a **hairline** border · **never recolored, never
  cropped** · must hold for arbitrary aspect ratios (a wide ~1459×388 wordmark **and** a square mark both look
  right in the same slot).
- **Switcher affordance:** the identity row carries a chevron that opens a menu (the workspace/identity menu —
  reuse the existing UX.7 identity menu; full multi-workspace *switching* is out of scope unless multi-org
  membership already exists — if so, flag). Keep the **collapse toggle** as its own control in the header; don't
  crowd it.
- **No lime in the header** — ink-on-paper only, so arbitrary tenant brand colors never clash with the accent.
- **Separation is one hairline (`--line`)** — never a heavy rule, never a boxed "powered by" badge.

## Guardrails

Real logos injected at runtime only (never committed — SEED.1; `verify:seed-1` stays green) · logo hygiene in
code (height cap, object-contain, neutral tile, no recolor/crop) · two independent flags · no lime in the header ·
additive migration only if `logo_variant` is truly needed (no `db push`) · collapse toggle + UX.14 rail behavior
preserved · v2 tokens · no emoji · a11y (the switcher + toggle are labeled, keyboard-operable; logo `<img>` has
alt = customer name).

## Verify + gate (`src/scripts/verify-sidebar-1.ts` + manual/a11y)

1. State A (no `logo_url`) renders the Axona square + "Axona" and **no** `ON AXONA` microlabel.
2. State B (`logo_url` set) renders the customer logo tile + name and the demoted Axona square + `ON AXONA`
   microlabel below a hairline; the Axona marker is **never larger/louder** than the tenant identity.
3. **Independent flags:** microlabel off does not remove the logo; co-branding off restores name = "Axona" + mark.
4. Logo hygiene holds for a **wide wordmark** and a **square** placeholder (height-capped, object-contain, not
   cropped/recolored), expanded and collapsed.
5. Collapsed 60px rail: co-branded (customer tile 28px + Axona square 13px + expand affordance) and Axona-only
   (just the square) both legible/tidy; UX.14 icon-nav intact.
6. `verify:seed-1` green (no committed marque); a11y 0 on `/core` (expanded + collapsed); existing shell/UX
   verifies stay green; `tsc --noEmit` clean.
CI gate: install --frozen-lockfile · lint · turbo typecheck · verify:all · pnpm eval (offline) · pnpm build ·
migrate clean; commit + push; Actions green.

## Review gate

Stop after SIDEBAR.1; show: State A and State B (with a wide-wordmark and a square placeholder logo), the
collapsed rail for both, and the two-independent-flags behavior — Axona never louder than the tenant, no lime in
the header, `verify:seed-1` green.
