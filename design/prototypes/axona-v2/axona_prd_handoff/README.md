# Axona — PRD Handoff Package

**For:** Head of Product (agent) tasked with writing a full, detailed PRD that Claude Code can implement.
**Subject:** Axona marketing website (the public homepage). Pre-launch.
**Status of inputs:** the marketing homepage exists as a **high-fidelity HTML design prototype** (see `design_reference/`). Your job is to turn it — plus the product context here — into a production-ready PRD.

---

## What's in this package

| File | What it is | Use it for |
|---|---|---|
| `README.md` | This file | Orientation + how to proceed |
| `00_product_context.md` | Synthesized Axona product/strategy context (product-relevant slice of the internal master doc) | Background so the PRD reflects the real product, positioning, and roadmap |
| `01_site_spec.md` | Section-by-section spec of the homepage: layout, copy, components, design tokens | The factual basis for the PRD's requirements + design system |
| `02_prd_instructions.md` | Exactly what PRD to produce, scope boundaries, and a fill-in skeleton | Your task definition + output template |
| `design_reference/Homepage.dc.html` | The hi-fi design prototype (open in a browser to see it) | Visual + interaction reference. **Not** the code to ship. |
| `design_reference/support.js` | Runtime needed to open the prototype locally | Only so the prototype renders |

---

## How to proceed

1. Read `00_product_context.md` so the PRD speaks the product's language (operating system, not "ERP"; humans+machines+agents; procurement wedge; primitives → domains → verticals).
2. Read `01_site_spec.md` for the concrete site structure, copy, and design tokens.
3. Follow `02_prd_instructions.md` to produce the PRD. Fill the skeleton; don't pad.
4. Open `design_reference/Homepage.dc.html` in a browser to see the intended look and motion.

## Important framing for the PRD
- The HTML prototype is a **design reference**, not production code. The PRD should instruct Claude Code to **rebuild the site in a real stack** (recommend Next.js + Tailwind, or match an existing repo if one is provided) — not to ship the prototype's `.dc.html` runtime.
- This is a **marketing website**, not the Axona product app. Keep that scope. The product app is a separate, future PRD.
- The site is **pre-launch**: all customer logos, testimonials, and the live "agents at work" / parts counters are **placeholder/illustrative**. The PRD must flag every placeholder and define how real content gets sourced or whether to launch with honest pre-launch framing (e.g. a design-partner program instead of fake traction).
- The name "Axona" and its trademark/domain are **not yet verified** (an unrelated medical-food "Axona" exists). Treat the wordmark as a placeholder pending a real logo.
