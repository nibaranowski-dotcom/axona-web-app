# 01 — Homepage Site Spec

A factual, section-by-section description of the hi-fi prototype (`design_reference/Homepage.dc.html`). Fidelity: **high** — colors, type, spacing, and copy are final-intent. Single page, max content width **1180px**, horizontal padding **28px**, on a white (`#fff`) background.

The company name is a single editable token (`companyName`, default **"Axona"**); it appears lowercased as the wordmark (`axona`) and uppercased in one stat label.

---

## Design tokens

**Color**
- Page background: `#fff`
- Panel / card surface (warm grey): `#f4f3ef`
- Ink (headlines/body strong): `#111`; near-black UI/footer: `#0a0a0a`
- Muted text: `#6b6b63`; lighter muted / placeholder ink: `#9a9a90`; faint mono: `#8a8a82` / `#a7a79d`
- Accent (lime): `#c6f24f`; accent hover: `#bce83f`
- Success green (status): `#1f9e6f`; success tint bg: `#e9f7f0`
- Borders: `#eee`, `#ededed`, `#e7e7e1`, `#e2e2e2`
- Dark footer divider: `#1d1d1d`

**Typography**
- Headlines / UI: **Archivo** (Google Fonts), weights 400/500/600/700. Headlines weight 600, letter-spacing about `-0.035em`, line-height ~1.0.
- Data labels / captions / counters: **JetBrains Mono**, weights 400/500, letter-spacing ~`.06em`, uppercase.
- Hero H1: `clamp(48px, 8.2vw, 108px)`, line-height ~0.92. Section H2: `clamp(30px, 4vw, 52px)`. Body: 14–21px.

**Shape & motion**
- Radii: cards/panels 12–16px; pills/buttons 7–9px (and `999px` for chips); large CTA panels 16px.
- Shadow (floating cards): `0 18px 40px rgba(0,0,0,.07)`; hero center card `0 26px 50px rgba(0,0,0,.28)`.
- Dotted-grid motif (`.dotgrid`): `radial-gradient(#d9d8d2 1.1px, transparent 1.1px)` at `18px 18px`.
- Selection highlight: lime `#c6f24f`.
- Two live tickers: a hero "parts under management" counter (increments ~every 1.2s) and the "agents at work" stat strip. **Both are decorative/illustrative.**

---

## Sections (top → bottom)

1. **Announcement bar** — black (`#0a0a0a`), white text, dismissible (✕). Copy: "Introducing Agents by Axona — the AI operating system for robotics ops." + "Learn more" link.

2. **Sticky nav** — translucent white, blur, bottom border. Left: `axona` wordmark + a small lime-tinted geometric mark. Nav items: Platform ▾, Modules ▾, Solutions ▾, Customers, Pricing. Right: "Sign in" + lime "See a demo" button.

3. **Hero** —
   - Mono eyebrow: "PARTS UNDER MANAGEMENT BY AXONA:" + live counter chip.
   - H1: **"Build robots. Not spreadsheets."**
   - Sub: "Inventory, production, supply chain, and finance — unified in one AI-native ERP for hardware teams." *(Note: candidate to align with "operating system" framing — flag in PRD.)*
   - Email capture row + lime "Book a demo".
   - **Hero panel** (dotted grid, `#f4f3ef`, min-height 540px): floating mock stack — a "BOM · WORK ORDER" card, a green "ROUTED FOR APPROVAL" card, and a dark center **per-unit build-genealogy card** (unit SN-2208, in-build bar at 84%, "Build genealogy · 142 parts traced"). All are stylized placeholders; real product screenshots go here.

4. **Agents-at-work strip** — bordered band, mono labels + value chips: BOMS SYNCED, AGENT ACTIONS, POS DRAFTED, SHORTAGES CAUGHT, UNITS TRACED. **Illustrative numbers.**

5. **Social proof / "Join"** — headline with lime underline ("Join 1,200 of the world's most ambitious hardware teams…"), "Read the report →" link, and a **6-column logo grid** with one 2×2 dark photo cell ("40hrs saved / month, per ops lead"). **All logos + the stat are placeholders.**

6. **One operating system / Domains** — H2 "One operating system. Every function on the floor." Sub: "Domains that share one spine — and infinite agents that work 24/7." Domain chip row (Procurement [active/black] · Manufacturing · Quality & Test · Logistics · Field Service · R&D · IT & Security). Then:
   - Two large feature cards: **Procurement** (the wedge) and **Manufacturing** (per-unit build genealogy).
   - Three small cards: **Quality & Test**, **Logistics**, **Field Service**.
   - Each card has a mono caption + skeleton UI placeholder.

7. **"Systems that never spoke."** — three grey placeholder tiles: SPREADSHEETS · PLM/CAD · ACCOUNTING (the legacy-tools-don't-talk problem).

8. **Architecture / Primitives** — eyebrow "THE ARCHITECTURE", H2 **"One system that adapts to how your factory runs."** A **4-layer stack** (each a full-width rounded grey row with a mono tag, title, body):
   - L4 · VERTICAL EDITIONS — "Vertical Editions"
   - L3 · DOMAIN APPS — "Domain Apps"
   - L2 · INTELLIGENCE & AGENT SPINE — "Intelligence & Agent Spine"
   - L1 · DATA & CONTEXT — "Data & Context"
   Then **"THE PRIMITIVES"** as a chip row: SOPs · Documents · Data · Agents · Humans · Machines · Inventory · Meetings · Integrations · Interfaces. *(All layers render on the same grey surface — Nicolas removed the earlier black "moat" highlight.)*

9. **Verticals** — dotted-grid panel, eyebrow "THE VERTICALS", H2 "One engine, proven on humanoids — then carried to every kind of robot company." 4-col grid of 8 tiles (Humanoids, Defense, Logistics → tagged **"Coming soon"** in lime; Manufacturing, Construction, Healthcare, Space, Automotive untagged), each with a mono index (01–08).

10. **Introducing Agents (split)** — left: H2 + a customer-style quote ("We turned off three legacy tools…") + "Read the story →". Right: grey panel with the `Axona` brand lockup placeholder.

11. **"Keep your ops team focused" (testimonial split)** — left: portrait placeholder ("Lauren, Head of Ops, drone manufacturer"). Right: H2 + body about agents handling busywork.

12. **"AI that learns" (policy card split)** — left: H2 + body. Right: a "Procurement Policy / Auto-applied" card with rows: Reorder point breach → AUTO-PO; Vendor lead-time risk → FLAGGED; Cost variance > 8% → ESCALATE.

13. **"Scale the line. Shrink the paperwork."** — two cards: Role-based access & approvals; One platform for every site.

14. **"We've got the receipts." (testimonials)** — 4-col grid of 8 placeholder customer quote cards (logo + quote + role).

15. **Closing CTA** — dotted-grid `#f4f3ef` panel, H2 **"Hit every build date."**, email capture + lime "Book a demo".

16. **Footer** — black (`#0a0a0a`). Wordmark + tagline, 4 link columns (PRODUCT / SOLUTIONS / COMPANY / RESOURCES), copyright line (notes placeholder wordmark), and a lime "See a demo" button.

---

## Interactions & behavior
- Sticky header on scroll; translucent + blur.
- Hover states: buttons darken lime (`#bce83f`); links fade to ~0.6 opacity; chips/cards gain a `#0a0a0a` border on hover.
- Announcement bar shows a ✕ (wire up dismiss + persistence in the real build).
- Two decorative tickers (hero parts counter; agent stat strip) — in the PRD, decide keep-as-illustrative vs. remove for a pre-launch honest build.
- Email-capture inputs are non-functional in the prototype — PRD must define real submit (CRM/waitlist/demo-booking).
- Fully responsive layout is **not** implemented in the prototype (desktop-first at ~1180px). The PRD must specify mobile/tablet breakpoints.

## Known placeholders to resolve in the PRD
Customer logos (grid + receipts), all testimonials and named people, the "1,200 teams" / "40hrs" / "3.2×" claims, hero & strip counters, product-screenshot regions (hero stack, card skeletons, brand lockup, portrait), and the wordmark/logo itself.
