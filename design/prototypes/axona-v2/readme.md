# Axona Design System

The shared visual foundation for **Axona** — the AI-native operating system for robotics companies — covering both the **marketing website** and the **product platform**.

This system was extracted from the approved marketing homepage (`Homepage.dc.html` at the project root) and generalized into reusable tokens, components, and UI kits so the website and the app stay visually consistent.

> **Sources:** the homepage prototype `Homepage.dc.html` (root) is the canonical visual reference. The product/strategy context lives in `axona_prd_handoff/` (PRD handoff package). Aesthetic lineage: a Ramp-like minimal-utility direction (near-white paper, warm-grey panels, single lime accent, mono data labels).

---

## Company / product context

Axona unifies **humans + machines + agents** into one system to run a robotics company end-to-end — procurement → production → quality → logistics → the field. It is positioned as an **operating system**, not an "ERP." The model is **primitives → domains → verticals**: build reusable primitives once, compose them into domain workflows, package them per vertical (Humanoids is the beachhead).

Two surfaces share this system:
- **Website** (`ui_kits/website/`) — the public marketing homepage. Real, approved design.
- **Platform** (`ui_kits/platform/`) — the product app. **Proposal/net-new** — no shipped app exists yet; these screens show how the language extends into a working tool.

Pre-launch caveats baked into every surface: customer logos, testimonials, counters, and product screenshots are **placeholders**; the "Axona" name/trademark is **unverified**.

---

## Content fundamentals (voice & copy)

- **Confident, plain, operator-to-operator.** Short declaratives. The hero is a two-beat: *"Build robots. Not spreadsheets."* Headlines are statements, not features.
- **"You" / "your"** addressing the customer; Axona refers to itself by name or "agents," never "we" heavily.
- **Operating system, never "ERP"** as the primary self-description. "ERP" may appear only as a comparison/SEO term.
- **Lead with outcomes, not modules:** "Hit every build date," "Keep your ops team focused on shipping," "Scale the line. Shrink the paperwork." Verb-first, concrete.
- **Numbers are mono and specific** (13,422 POs drafted; 142 parts traced; SN-2208) — they read like a machine reported them. Keep them honest/flagged pre-launch.
- **Casing:** Sentence case for headlines and body. UPPERCASE only for mono eyebrows/labels (`THE ARCHITECTURE`, `PARTS UNDER MANAGEMENT`). Title Case avoided.
- **No emoji.** No exclamation-heavy hype. No buzzword stacking ("synergy," "revolutionary"). Differentiator phrased structurally: *humans + machines + agents as one workforce.*
- **Punctuation:** em dashes for asides; "·" (middle dot) as a mono separator in labels and metadata.

---

## Visual foundations

**Overall feel:** near-white, editorial, utility-minimal. Generous whitespace on the website; denser on the platform. Tight, heavy headlines against quiet warm-grey panels, with a single electric-lime accent doing all the "energy."

- **Color:** paper `#fff`; warm-grey product panels `#f4f3ef` (zebra alt `#f7f2eb`); ink `#111` / near-black `#0a0a0a`; muted `#6b6b63`, faint `#9a9a90`. One accent — **lime `#c6f24f`** (hover `#bce83f`, ink-on-accent `#0a0a0a`) for primary actions, the selection highlight, "Coming soon" badges, and chart highlights. Functional **green `#1f9e6f`** + tint `#e9f7f0` for live/approved/auto-applied status. That's the whole palette — no gradients, no secondary brand hues.
- **Type:** **Archivo** for all UI + display (weight 600 headlines, heavy negative tracking ~-.035em→-.045em, line-height ~0.92–1.02); **JetBrains Mono** for data, eyebrows, captions, counters, table headers (uppercased, +.06em tracking, 10–11px). The mono/sans contrast is the signature typographic move.
- **Backgrounds & motifs:** the **dotted grid** (`radial-gradient(#d9d8d2 1.1px, transparent 1.1px)` @ 18px) on heros and CTA panels (`.ax-dotgrid`). Striped/skeleton fills stand in for unshot product imagery. No photography baked in (placeholders only); when added, imagery should read warm and product-forward.
- **Cards & surfaces:** warm-grey `#f4f3ef`, radius 14px, **no border on panels, hairline `#e7e7e1` on inner mock-UI cards**. The signature "feature card" = title + body + a skeleton mock-UI footer that suggests a screenshot (rounded only at the top, bleeding off the bottom). Floating mock cards use white + `0 18px 40px rgba(0,0,0,.07)`.
- **Radii:** pills/badges 999px; buttons & inputs 8px (7–9px range); cards 14px; large panels 16px.
- **Shadows:** restrained. Float `0 18px 40px rgba(0,0,0,.07)`; the dark hero card `0 26px 50px rgba(0,0,0,.28)`. Most surfaces are flat with a hairline instead.
- **Borders / hairlines:** `#ededed` default, `#e7e7e1` on panels, `#e2e2e2` on chips/inputs, `#1d1d1d` on the dark footer. Hairlines (not shadows) do most of the separating.
- **Buttons:** lime primary (`Button variant=primary`), near-black `dark`, outlined `ghost`. Weight 600, pill-ish 8px. The email-capture pattern fuses an input to a lime button.
- **Hover/press:** buttons darken (lime→`#bce83f`, dark→`#000`); links fade to ~0.6 opacity; chips/cards gain a `#0a0a0a` border. Subtle — `0.2s` ease `cubic-bezier(.2,.6,.2,1)`. No bounces or scale-pops.
- **Motion:** minimal and functional. Live counters tick (decorative); transitions are short fades/color shifts. Respect reduced-motion.
- **Layout:** website container max 1180px, 28px gutters, ~88px section rhythm. Platform uses a 232px sidebar + 60px topbar and 16–28px gaps. Sticky translucent (blur) nav on the site; sticky topbar in the app.

---

## Iconography

The brand is **near icon-free by design** — it leans on mono labels, "·" separators, geometric dots/squares, and skeleton shapes instead of decorative icons. The wordmark mark is a single rounded-corner square (`border-radius: 0 7px 0 7px`). Status uses small filled dots (lime / green) rather than glyphs.

When functional icons are needed (primarily in the **platform** app — nav, table actions), use a **thin-stroke line set — [Lucide](https://lucide.dev)** (CDN: `https://unpkg.com/lucide@latest`) as the substitute, matching the ~1.5px stroke, minimal style. *Flag: no proprietary icon set exists yet; Lucide is a recommendation, not an established choice.* **No emoji**, ever, in product or marketing. (The platform kit currently uses a few unicode glyphs as nav placeholders — swap for Lucide in production.)

---

## Index / manifest

**Root**
- `styles.css` — global entry point; `@import`s every token + font file. Consumers link this.
- `Homepage.dc.html` — canonical homepage prototype (visual source of truth).
- `SKILL.md` — Agent-Skills-compatible entry for using this system in Claude Code.
- `axona_prd_handoff/` — product context + website spec + PRD instructions (handoff package).

**`tokens/`** — `fonts.css` (Archivo + JetBrains Mono via Google Fonts), `colors.css`, `typography.css`, `spacing.css`, `radii-shadow.css` (incl. the `.ax-dotgrid` utility).

**`guidelines/`** — foundation specimen cards (Colors, Type, Spacing, Brand) shown in the Design System tab.

**`components/`** — reusable React primitives:
- `core/` — `Button`, `Chip`, `Badge`, `StatChip`
- `surfaces/` — `Card`, `LayerRow`
- `forms/` — `Input`
Each is `<Name>.jsx` + `<Name>.d.ts` + `<Name>.prompt.md`, with a `*.card.html` demo per directory.

**`ui_kits/`**
- `website/` — marketing homepage recreation (real design).
- `platform/` — product app proposal (net-new): Overview, Procurement, Build genealogy + placeholders.

---

## Using this system

- **Static artifacts** (mocks, slides, prototypes): link `styles.css`, use the CSS variables, copy components/markup from the UI kits.
- **Production code**: treat the tokens as the source of truth; port the components into your stack (the website PRD recommends Next.js + Tailwind — map these tokens to the Tailwind theme).
- Components reference styling **only** via CSS custom properties — restyle the whole system by editing `tokens/`.
