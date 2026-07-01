# Axona — Sales Deck & Seed Deck Briefs

Two presentation briefs you can hand to Claude in a deck project (attach the **Axona Design System**, then "build this deck"). Both follow the brand: **operating system, never "ERP"**; operator-to-operator voice; sentence-case prose, UPPERCASE only for mono labels/codes; lime accent as signal on ink-on-paper; concrete numbers and codes; no emoji.

**Shared deck system**
- 1920×1080, light-canonical. Paper `#fff` fields, warm `#f4f3ef` panels, ink `#0a0a0a`, single lime `#c6f24f` accent, functional green `#1f9e6f` only.
- Type: Archivo (display/body), JetBrains Mono (labels, codes, counters, page numbers).
- Layout kit: a **title/section-header** layout (mono eyebrow + big Archivo headline on paper or ink), a **statement** layout (one big line, lots of air), a **split** layout (claim left / mock-UI or data right), a **grid** layout (3–4 cards), and a **full-bleed dark** layout for the device/agent moment (`linear-gradient(135deg,#1a1a1a,#000)`). Dot-grid motif behind section headers and the closing slide only.
- Min type 24px; headlines 3–7 words, two-beat contrast where possible.

---

## A. SALES DECK — "Build robots. Not spreadsheets."
**Audience:** VP Ops / COO / Head of Manufacturing at a robotics company (Series B–D, deploying fleets).
**Goal:** land a demo + pilot. **Length:** 14 slides, ~15 min. **Arc:** their pain → the wedge → the system → the moat → proof → ask.

1. **Cover** — `AXONA` wordmark + asymmetric mark; headline *"Build robots. Not spreadsheets."*; sub *"The operating system for robotics companies."* Mono footer: customer name · date.
2. **The problem** — *"Systems that never spoke."* Robotics ops run on 8+ disconnected tools (ERP, MES, CRM, spreadsheets, field-service). Statement layout; mono list of the siloed systems.
3. **Why it hurts** — three cost cards: missed build dates, margin leaking per unit, blind fleet in the field. Concrete: *"a single late long-lead part slips 3 builds."*
4. **The wedge** — *"Start where it bleeds: procurement + per-unit build genealogy."* Split: claim left, a PO-queue + build-traceability mock right (`PO-10482`, `SN-2208`).
5. **One operating system** — the four-layer spine: primitives → domains → verticals → **the intelligence/agent layer (THE MOAT)**. Grid/diagram, lime tag on the moat layer.
6. **Every function on the floor** — the module map: Value chain · Robotics · Back office (one compact grid of the 17 modules). "One spine, every function."
7. **The agent spine** — *"AI that learns from your operation."* Full-bleed dark slide: the dot-ring agent glyph + an agent-trace console streaming (scan → correlate → draft → approve). ~6 agents per module; humans approve.
8. **A day in the operation** (the killer slide) — follow one event end-to-end: torque drifts → Quality SPC flags it → NCR-118 → ECO-318 supersedes the drive → Procurement re-sources → Fulfillment clears customs → Field Service dispatches a certified tech → Finance sees the margin hit → Legal checks the SLA. One horizontal flow; shows the modules talking.
9. **Mission Control** — the command center: KPI tiles per domain + cross-module exceptions ("supplier delay threatens 3 builds"). Split with the Command Center mock.
10. **Workflows & Projects** — orchestrate agents (trigger → steps → gates → output) and work the files (Hebbia-style matrix + ask-across-documents). Two mocks.
11. **Deliverability, proven** — the sales↔ops bridge: every quote knows if ops can build+deliver by the date. Mock of the deal with the at-risk badge.
12. **Proof** — outcome metrics card row: *hit every build date · margin per unit visible · fleet uptime.* Mono stats; one operator quote (placeholder, `[ CUSTOMER QUOTE ]`).
13. **Rollout** — *"Land in procurement. Expand to the whole floor."* 3-step adoption timeline (wedge → domains → full ops), low-risk pilot framing.
14. **Close** — dot-grid CTA: *"One operating system. Every function on the floor."* + `Book a demo` (lime). Mono contact line.

---

## B. SEED DECK — fundraising
**Audience:** seed/Series-A VCs. **Goal:** term sheet. **Length:** 12 slides, ~10 min. **Arc:** big shift → problem → product → wedge/why-now → moat → market → traction → team → ask. Keep it tighter and more declarative than the sales deck.

1. **Cover** — `AXONA`; *"The operating system for robotics companies."* Mono: round · date · contact.
2. **The shift** — *"Robots are becoming an industry."* Humanoids + industrial automation are scaling from pilots to fleets; the companies building them run on software that wasn't built for them.
3. **The problem** — *"Robotics companies run their operation on tools that never spoke."* ERP/MES/CRM/field-service stitched by spreadsheets; the cost compounds as they scale units.
4. **The insight / why now** — robots are humans + machines + agents on one spine; AI agents can finally *run* operational work, not just record it. Now-or-never: the robotics build-out + capable agents arriving together.
5. **Product** — *"One operating system. Every function on the floor."* The four-layer spine diagram; one strong product shot (Mission Control or the agent spine, dark).
6. **The wedge** — *"We land where it bleeds: procurement + per-unit build genealogy, then expand."* Why this beachhead converts and expands across the floor.
7. **The moat** — *"AI that learns from your operation."* The multi-agent layer is the defensibility: cross-module agents + the proprietary operational data they train on. This is the slide investors remember.
8. **Market** — TAM framing: every company designing/building/deploying robots; land-and-expand seat + module economics (hardware + RaaS-style operating layer). Keep numbers honest and sourced `[ SOURCE ]`.
9. **Business model** — platform subscription + per-module expansion; expansion revenue as the floor adopts more modules. One simple economics card.
10. **Traction** — `[ design partners ]`, pipeline, early usage; the cross-module story as a live demo proof point. Mono stat row (fill with real numbers).
11. **Team** — why this team builds the operating system for robotics (ops + robotics + AI). Hatch-fill portrait placeholders + mono roles.
12. **The ask** — `[ $ amount ]` to `[ milestones ]`. Dot-grid close; *"Build the operating system for robotics."* + contact.

---

## Build notes for the deck project
- Attach the **Axona Design System**; use its `Button` (lime, once per slide max), `MonoChip` for codes/stats, `Badge` for tags (THE MOAT / pilot), `StatTile`/`FeatureCard` for grids.
- Reuse real artifacts as mock imagery: the dot-ring agent glyph, the agent-trace console, the Command Center KPI grid, the SPC chart, the delivery pipeline, the deal deliverability badge — they make the decks concrete instead of generic.
- Keep the "day in the operation" flow (sales slide 8) and the "moat" slide (seed slide 7) as the two anchor slides — design those hardest.
- Export: editable PPTX (native shapes/text) or PDF from the deck project.
- Placeholders to fill before sending: customer name/quote, traction numbers, market sources, team bios, raise amount + milestones.
