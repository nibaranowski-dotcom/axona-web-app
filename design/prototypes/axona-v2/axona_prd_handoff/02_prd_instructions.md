# 02 — PRD Instructions (your task)

You are the **Head of Product**. Produce a **complete, build-ready PRD for the Axona marketing website** that Claude Code can implement end-to-end without further clarification. Ground every requirement in `00_product_context.md` and `01_site_spec.md`; open `design_reference/Homepage.dc.html` to confirm look and motion.

## Scope
- **In scope:** the public marketing homepage (the design provided), plus the immediately implied supporting pieces: navigation, demo-request / email-capture flow, basic SEO/meta, analytics events, responsive behavior, accessibility, and a CMS-or-config strategy for the placeholder content.
- **Out of scope (state explicitly):** the Axona product application itself, auth, pricing/billing systems, and any secondary marketing pages unless you justify them as launch-critical (if so, list them with rationale).

## Hard requirements the PRD must honor
1. **Rebuild, don't ship the prototype.** Specify a real stack — recommend **Next.js (App Router) + TypeScript + Tailwind CSS**, or match an existing repo if the team provides one. The `.dc.html` file is a design reference only.
2. **Positioning fidelity:** "operating system," not "ERP" as the primary descriptor; lead with **humans + machines + agents** and the **procurement + per-unit-genealogy wedge**; keep the **primitives → domains → verticals** model intact.
3. **Pre-launch honesty:** treat every logo/testimonial/stat/counter as a placeholder. Define, per item, whether to (a) source real content before launch, (b) reframe honestly (e.g. design-partner program, "request early access"), or (c) cut. Do not let the shipped site imply fake traction.
4. **No internal material on the public site:** no named contacts, team/hiring status, ITAR notes, investors, competitor analysis, or ACV/pricing math.
5. **Design system:** codify the tokens in `01_site_spec.md` (color, type scale, radii, shadows, spacing, the dotted-grid motif, lime accent usage) as the source of truth.

## What the PRD must add beyond the prototype
- **Responsive spec:** breakpoints and how each section reflows (the prototype is desktop-first at ~1180px). Mobile nav pattern.
- **Accessibility:** WCAG 2.1 AA — color contrast (verify lime-on-white and grey text), focus states, keyboard nav, reduced-motion handling for the tickers, alt text strategy for the (future) imagery.
- **Functional forms:** demo-request and email capture — destination (CRM/waitlist), validation, success/error states, spam protection, confirmation.
- **Analytics & events:** define the event taxonomy (CTA clicks, form submits, section views, nav).
- **SEO/meta:** title/description, Open Graph, structured data, the "Axona" naming caveat (trademark unverified — flag for legal before launch).
- **Content/CMS strategy:** how placeholder content (logos, testimonials, verticals, copy) is managed and swapped — static config vs. a CMS.
- **Performance budget:** font loading (Archivo + JetBrains Mono), image strategy for the eventual product shots/photos, Lighthouse targets.

## Deliverable format
Produce `PRD_Axona_Website.md` with this structure (fill it; cut sections only with a one-line reason):

1. **Summary** — what we're building and why, in 4–6 sentences.
2. **Goals & non-goals** — measurable goals (e.g. demo requests), explicit non-goals.
3. **Target users & primary journeys** — the ops buyer and the procurement champion; the path to "Book a demo."
4. **Positioning & messaging guardrails** — the rules from §2 above, with approved phrasing.
5. **Information architecture** — page + section list (map 1:1 to `01_site_spec.md`), nav, footer.
6. **Section-by-section requirements** — for each section: purpose, layout, components, final copy (or copy direction), states, and any placeholder-resolution decision.
7. **Design system** — tokens, components, motion, the dotted-grid + lime usage rules.
8. **Functional requirements** — forms, analytics, SEO, CMS/config, dismissible bar.
9. **Responsive & accessibility requirements.**
10. **Non-functional** — performance budget, browser support, security/privacy (form data).
11. **Tech approach** — recommended stack, project structure, how to translate the prototype, deployment.
12. **Open questions & decisions needed** — naming/trademark, real content sourcing, keep/remove tickers, any extra pages.
13. **Acceptance criteria** — a concrete, testable checklist Claude Code can self-verify against.
14. **Build plan / milestones** — suggested phased implementation order for Claude Code.

## Style for Claude Code consumption
- Be specific and testable. Prefer checklists and explicit values over prose.
- Reference section names from `01_site_spec.md` so requirements map cleanly to the design.
- Every requirement should be implementable without asking a human — or listed in §12 as a decision needed.
