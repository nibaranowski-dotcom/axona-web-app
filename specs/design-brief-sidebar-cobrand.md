# Design brief — Sidebar header co-branding (Axona + customer logo)

**For:** Claude Design (produces the `.dc.html` in the Axona v2 system). **From:** Head of Product.
**Goal:** redesign the **sidebar header** (top of the 240px left nav) so it deliberately **co-brands** — a clear
place for the **Axona product identity** *and* the **tenant/customer's logo** — reading, in effect, *"‹Customer›
runs on Axona."* It must work for our own org (Axona-only) and for a customer/prospect tenant (Axona + their
logo), expanded and collapsed.

## Why

Each tenant is a customer running *on* Axona. Today the header shows either the customer's logo **or** the org
name, plus a small Axona square mark — the two identities aren't deliberately composed. For demos (and real
customers), we want a confident co-brand: the customer feels ownership, Axona is present as the platform.

## What exists now (the constraints)

- **Sidebar:** 240px expanded · **60px collapsed rail** · paper background · hairline right border.
- **Axona mark:** an asymmetric square (`border-radius: 0 7px 0 7px`, ink fill) — this is the product marker.
- **Axona wordmark:** lowercase "axona" (Archivo, bold, tight tracking).
- Header also holds the **collapse toggle** button (right side).
- Customer logos vary wildly in shape/color — e.g. a wide wordmark (~1459×388) or a squarer mark; they carry
  their own brand colors.

## Design the header — two states

**State A · Axona-only** (our org / no customer logo): the Axona wordmark + square mark, as the primary identity.

**State B · Co-branded** (a customer logo is set): compose **both** — the **customer's logo** (primary, they own
the workspace) with a **clear, secondary Axona presence** (the square mark and/or a small "on Axona" / "powered
by" mono tag). Propose the hierarchy; intent is **customer-forward, Axona as the trusted platform marker**, with
a **hairline divider** (per the DS) separating the two identities.

## Requirements

- **Both states in one component**, switching on whether a customer logo is present.
- **Customer-logo hygiene:** constrain to a **max height** (≈20–24px expanded), `object-contain`, sit on a
  **neutral paper/panel surface**, **never recolored** — give it breathing room so its colors don't clash with
  the lime accent. Assume arbitrary aspect ratios (wide wordmark and square both look right).
- **Collapsed 60px rail:** define how the co-brand degrades — e.g. the customer logo reduces to a small square/
  monogram tile and the Axona square mark persists (or pick one identity for the rail). Must stay legible + tidy
  at 60px, and keep the expand affordance.
- **Divider / relationship:** a hairline (not a heavy rule) expresses "customer × Axona"; consider a small
  UPPERCASE MONO "ON AXONA" microlabel if it reads cleanly.
- Keep the **collapse toggle** in the header; don't crowd it.

## Inspiration — how the best B2B SaaS / ERP handle workspace identity

Study how **Linear, Ramp, Vercel, Notion, Stripe** (and the craft bar we target — **Harvey, Hebbia**) treat the
top-of-sidebar org/workspace identity, and borrow their **restraint**:

- The dominant pattern is a compact **workspace switcher**: `[small workspace avatar/logo] + [workspace name] +
  a subtle chevron/▾` — one quiet line, tight, no ornament. It doubles as the switch/menu affordance.
- The **product's own brand is usually implicit** (small or absent in the sidebar) — the *workspace* is the hero.
  Our co-brand should keep **Axona in that quiet-but-present register** (a small square mark and/or an UPPERCASE
  MONO "ON AXONA" microlabel), never a second loud logo competing with the customer's.
- **Craft cues to match:** ~20–24px squared/rounded-square avatar · medium-weight name · tight, generous spacing ·
  a single hairline for separation · an unobtrusive menu/switch affordance · everything on one clean row.
- **Anti-patterns to avoid:** two big competing logos side-by-side · a heavy divider rule · a boxed "powered by"
  badge that reads like an ad · any clutter around the collapse toggle.

Net target: **customer-forward and restrained** (Linear/Ramp-level polish), with Axona as a **confident, minimal
platform marker** — not a co-logo slap.

## Design system (Axona v2 — match the existing `.dc.html` set)

Archivo (display) + JetBrains Mono (UPPERCASE labels/microcopy) · paper `#ffffff` · panel `#f4f3ef` · ink
`#0a0a0a` · single accent lime `#c6f24f` · hairlines over shadows · the asymmetric square mark · dotted-grid
motif · **no emoji** · Lucide icons (thin ~1.5px) for the toggle. 240px sidebar · 60px rail.

## Deliverable

The sidebar **header** treatment as a `.dc.html` (a fragment, or an updated header region within
`Design System.dc.html` / `Command Center.dc.html`), showing **both states** (Axona-only and co-branded) and the
**collapsed-rail** variant. Use a **generic placeholder "Customer" logo box** — do **not** embed any real company
logo or name in the design file (real marques never live in our design/repo; the app injects the real logo at
runtime).
