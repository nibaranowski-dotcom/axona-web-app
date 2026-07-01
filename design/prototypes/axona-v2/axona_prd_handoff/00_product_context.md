# 00 — Axona Product Context

> Product-relevant synthesis of the internal master doc. Strategy/network/team details that don't affect the website have been omitted. Use this to keep the PRD true to the product; do not put internal-only material (named contacts, hiring status, ITAR notes, investor lists, ACV/pricing math, competitor analysis) on the public site.

## One-liner
Axona is **the AI-native operating system for robotics companies** — it unifies humans, machines, and agents into one system to run a robotics company across procurement → production → quality → the field, powered by specialized models and memory that compound with every build.

## Positioning rules (non-negotiable for copy)
- Frame as an **operating system**, not "ERP." ("ERP" may appear as a comparison/SEO term, never as the primary self-description.)
- The differentiating idea: **a robotics company's workforce is humans + machines + agents.** Horizontal tools model a human-only company; Axona models all three as first-class. This is the core "why us."
- **Vertical focus is the strategy** — the buyer self-identifies (a humanoid/defense/logistics ops leader), and the product builds the "last 10%" that horizontal tools won't.

## The wedge (what to show first / most concretely)
- **Agentic procurement / supply chain** + **per-unit build genealogy.** This is the MVP and the most credible, concrete thing to illustrate (sourcing long-lead components, RFQs, auto-drafted POs from live BOM demand, traceability of every part to every unit/serial).

## Audience (who the site speaks to)
- **Economic buyer:** VP/Head of Operations, COO, Head of Supply Chain. Cares about ramp speed, on-time production, cost, not missing build dates.
- **Champion/user:** procurement lead, production/ops manager. Wants to kill manual sourcing/RFQ/BOM grind.
- **Buyer concerns to address on-site:** security review, data residency (VPC / on-prem / edge), and for defense, export control. Surfacing trust/security matters.

## The product model — three pillars
Build the **primitives** once → compose them into **domain** workflows → package per **vertical**.

- **Primitives (elements):** SOPs · Documents · Data · Agents · Humans · Machines (fixed + mobile) · Inventory · Meetings · Integrations · Interfaces.
- **Domains (functions):** Procurement (MVP wedge) · Manufacturing · Quality & Test · Logistics · Field Service · R&D · IT/Security · Sales · Marketing.
- **Verticals (markets):** Humanoids (beachhead) · Defense · Logistics · Manufacturing · Construction · Healthcare · Space · Automotive.

## Technical architecture — 4 layers (how the pillars are implemented)
- **L1 · Data & Context** — connectors (ERP/PLM/MES, email, tickets, Slack, docs, SOPs, robot telemetry, sensor/teleop logs) + an auto-built **ontology** of how the company works. Control plane: VPC/on-prem/edge, SOC 2, RBAC, single-tenant.
- **L2 · Intelligence & Agent Spine** — self-improving agents (skills, context, memory, system prompt, multimodal); specialized models (RL post-training + fine-tuning on proprietary robotics data; own/swappable, on-prem/edge); long-term operational memory + **per-unit build genealogy**; multi-agent orchestration of humans + machines + agents. *(Internally this is "the moat" — do not label it that on the public site; Nicolas removed that wording.)*
- **L3 · Domain Apps** — composable workflows from shared primitives.
- **L4 · Vertical Editions** — the domain-specific "last 10%" + tailored UI per vertical.
- **Cross-cutting rails:** Trust & Governance (earned/progressive autonomy, human-in-the-loop, full audit, observability) · Continuous Learning Loop (deploy → observe → learn → improve).

## Pre-launch reality (must shape the site's honesty)
- No shipped customers yet. Treat logos, testimonials, counts, and live tickers as **illustrative placeholders**.
- Roadmap framing: Humanoids/Defense/Logistics are the **near-term ("Coming soon")** verticals on the site; the rest are directional.
- Naming: "Axona" trademark/domain unverified.

## Visual direction reference
The current site adopts a **Ramp-like aesthetic**: near-white background, warm-grey product panels (`#f4f3ef`), tight black Archivo headlines, a single lime accent (`#c6f24f`), a dotted-grid motif, and mono (JetBrains Mono) data labels. See `01_site_spec.md` for exact tokens.
