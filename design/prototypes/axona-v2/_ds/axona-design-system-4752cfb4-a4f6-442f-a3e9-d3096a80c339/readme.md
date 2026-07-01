# Axona — Design System

The shared visual foundation for **Axona**: the AI-native **operating system for robotics companies**.
Axona puts humans, machines, and agents on one spine — leading with procurement and per-unit build
genealogy, expanding to run the whole operation (manufacturing, quality, logistics, field service).

Two products share this system:

1. **Marketing website** (`axonahq.com`) — the v2 light-canonical redesign. Positioning, hero, the
   four-layer architecture, verticals, closing CTA. → `ui_kits/website/`
2. **The platform** — the in-app operational-intelligence product: fleet, procurement, incidents,
   the agent spine. Denser than the site, same foundation. → `ui_kits/platform/`

Positioning is non-negotiable: **"operating system," never "ERP."** Lead with humans + machines +
agents; the wedge is procurement + per-unit build genealogy; the spine is primitives → domains →
verticals, with the intelligence/agent layer as **THE MOAT**.

---

## Sources

This system was reverse-engineered from materials the user provided. You may not have access; the
references are stored here in case you do.

- **Commercial website codebase** — `Axona-Commercial-Website/` (Next.js + Tailwind v4 + shadcn).
  Tokens: `app/globals.css`. Components: `components/v2/*`. Copy: `content/site-v2.ts`. Authoritative
  token doc: `design.md`.
- **GitHub** — <https://github.com/nibaranowski-dotcom/axona> (the same project as the codebase above).
  Explore this repo to build more faithful Axona designs.
- **Design system specimen** — `uploads/Design System.pdf` — the single-page spec sheet covering
  color, type, spacing, radii/shadow, brand, components, and the platform/in-app surface (§07).

> **Font substitution flag:** Archivo + JetBrains Mono are loaded from **Google Fonts** (the codebase
> self-hosts them via `next/font`). These are the correct families — no visual substitution — but if
> you need offline/self-hosted binaries, drop them in `assets/fonts/` and update `tokens/fonts.css`.

---

## Content fundamentals

How Axona writes. The voice is **operator-to-operator** — like it was written by someone who runs the
line, not a marketer.

- **Tone:** confident, plain, technical-but-warm. Short declaratives. Lead with the **outcome**, not
  the module. "Build robots. Not spreadsheets." / "Hit every build date." / "Systems that never spoke."
- **Casing:** **sentence case** everywhere in prose and headings. UPPERCASE is reserved for
  JetBrains Mono labels, codes, and counters (`THE ARCHITECTURE`, `PARTS UNDER MANAGEMENT`, `SN-2208`).
- **Person:** addresses the reader as **you / your** ("your buyers approve in one click", "keep your
  ops team focused"); the product and its agents are the actors ("Agents source long-lead components").
- **Numbers & codes:** concrete and mono-set — `7,491,284 parts`, `PO-10482`, `98.2%`, `$48,200`,
  `ETA 4 days`. Specificity signals a real system.
- **No emoji. No exclamation-driven hype.** Punctuation is calm; the em-dash and the mid-dot (`·`)
  do the structural work (`Fleet · Site-3 · SN-2208`).
- **Headlines** are 3–7 words, often a two-beat contrast ("Scale the line. Shrink the paperwork.").
- **Vibe:** precise product, not a brochure. Would sit next to linear.app / harvey.ai.

Examples (real copy): *"Build robots. Not spreadsheets."* · *"One operating system. Every function on
the floor."* · *"AI that learns from your operation."* · *"We've got the receipts."*

---

## Visual foundations

**Light-canonical. One accent. One texture.** (Dark mode is deferred — never auto-invert.)

- **Color:** ink on warm paper. `#fff` canvas, `#f4f3ef` panels, `#0a0a0a` ink for the announce bar,
  footer, marks, and text-on-lime. The single accent is **lime `#c6f24f`** (hover `#bce83f`) — it
  appears on CTA buttons, the one highlight, status/MOAT/MVP tags, build bars. If a screen reads "all
  lime," pull back: lime is signal, the field is ink-on-paper. Status uses **functional green only**
  (`#1f9e6f`); there are **no invented reds** — severity is shown by weight and label.
- **Type:** **Archivo** (400–700) for display + body; **JetBrains Mono** (400/500) for labels, codes,
  counters. Display is 600–700 with fluid `clamp()` sizes and tight tracking (−0.03 to −0.045em on
  big headings). Mono is UPPERCASE at +.06–.08em. No third typeface. Type does the work.
- **Spacing & layout:** 4px base scale. Content max-width **1180px** with 28px gutters. Generous
  vertical rhythm between sections (72–88px).
- **Backgrounds:** mostly flat paper and warm panels. **The dotted grid is THE motif** — a radial dot
  grid (`#d9d8d2` 1.1px @ 18px) behind the hero panel, the verticals band, and the closing CTA. Don't
  add competing motifs. The two dark device-card gradients (`linear-gradient(135deg,#1a1a1a,#000)`)
  are deliberate, contained device art — not a paint style. Placeholder portraits use a 135° hatch.
- **Corners:** rounded forms — `6px` (sm), `8px` (buttons), `10px` (mock cards), `14px` (cards),
  `16px` (panels), `999px` pills for tabs/tags. The brand mark is an asymmetric square
  (`border-radius: 0 7px 0 7px`).
- **Elevation:** **soft only.** Floating mock cards get `0 18px 40px rgba(0,0,0,.07)`; the tilted hero
  device card gets `0 26px 50px rgba(0,0,0,.28)`. No heavy shadow stacks; most cards are flat with a
  hairline border (`#ededed` / `#e7e7e1`).
- **Cards:** two flavors — (a) warm `--panel` fill, no border, rounded 14px (marketing feature cards);
  (b) `--paper` fill with a `--line` hairline border, rounded 12–14px (data/testimonial/platform
  cards). Mock product surfaces inside cards are white with a top-only hairline and skeleton bars.
- **Hover:** links and nav fade to ~60% opacity; lime buttons darken to `--lime-hover`; secondary
  buttons darken their border to ink; pills/primitives shift border to ink. **Press:** subtle 1px
  downward nudge on buttons (from the shadcn base). No bounces.
- **Motion:** quiet — `0.15s ease` on opacity / background / border. Honor `prefers-reduced-motion`
  (all animation/transition is killed under reduce). No infinite decorative loops.
- **Transparency/blur:** the sticky nav is `rgba(255,255,255,0.9)` with `backdrop-filter: blur(12px)`.
  Used sparingly — only for floating chrome.
- **Imagery:** the prototype uses **no photos** — customer portraits are hatch-fill placeholders with
  a `[ CUSTOMER PHOTO ]` mono tag (tracked for pre-launch swap). When real imagery arrives it should
  read warm and neutral, not stylized.

---

## Iconography

- **No proprietary icon set ships** with the product. The website uses Unicode glyphs as micro-icons:
  the caret `▾` in nav, the arrow `→` in text links, the `·` mid-dot as a separator, `⌘K` for the
  command palette, and a small 3×2 dot grid as the "agents at work" mark. The brand mark itself is a
  CSS square with asymmetric corners (see `assets/mark-*.svg`, `assets/wordmark-*.svg`).
- **For the platform** (which needs real UI icons), this system substitutes **[Lucide](https://lucide.dev)**
  (CDN) — clean technical line icons at ~1.8 stroke weight, a close match to the brand's precise,
  understated feel. *(Substitution — flag for review; swap when a real Axona icon set exists.)*
  Used: `layout-grid`, `cpu`, `shopping-cart`, `triangle-alert`, `settings`, `search`, `bell`,
  `circle-help`, `sparkles`.
- **No emoji**, ever.

---

## Index / manifest

**Root**
- `styles.css` — global entry point (the one file consumers link). `@import` list only.
- `tokens/` — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `radii-shadow.css`,
  `motifs.css` (the dotgrid + hatch helpers).
- `assets/` — `mark-{ink,paper,lime}.svg`, `wordmark-{ink,paper}.svg`.
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Brand).
- `SKILL.md` — Agent-Skill-compatible entry point.

**Components** (`window.AxonaDesignSystem_4752cf.*`)
- `components/core/` — `Button`, `MonoChip`, `Badge`, `StatChip`, `ArrowLink`, `Pill`, `Wordmark`
- `components/forms/` — `EmailCapture`, `Toggle`, `Select`
- `components/data/` — `StatTile`, `FeatureCard`, `Skel`

**UI kits**
- `ui_kits/website/` — the Axona v2 marketing homepage (interactive).
- `ui_kits/platform/` — the operational-intelligence app: procurement / fleet dashboard (interactive).

To use a component in a card or kit: link `styles.css`, load `_ds_bundle.js` (generated), then
`const { Button } = window.AxonaDesignSystem_4752cf`.
