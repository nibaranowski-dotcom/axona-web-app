# Addon 3 — "Export simplified screens" (run by the MAIN Claude design web-app project)

> **Who runs this:** the **main Claude design project that built the Axona web app** (the one holding the
> `*.dc.html` screens / the build-spec app) — NOT the deck designer and NOT this Cowork workspace. Only
> that project has the real screens to simplify. It is the third deck addon: it produces the screen files
> the two deck addons reference.

_You built the Axona app screens (see `../reference/axona-build-spec.md` + the `*.dc.html` prototypes).
Task: export **simplified, deck-ready crops** of specific screens so the deck designer can drop real
product UI into demo slides. Produce **two markdown files**, then hand them off:_
- `company/deck/screens-export-seed.md` → for the **seed (investor) deck** (`content.md` + `content-addon-product.md`)
- `company/deck/screens-export-sales.md` → for the **sales deck** (`sales-content.md` + `sales-content-addon-product.md`)

Real screens-in-deck = "built, not slideware." This is the highest-credibility asset; make them clean.

## Output format — one block per screen (identical in both files)
For each screen, emit:
```
### <SCREEN NAME> → <which deck slide it lands on>
- **Purpose on the slide:** <one line: what it proves>
- **Crop:** <what to show / what to hide vs the full screen>
- **Render:** a single self-contained HTML snippet (inline CSS, v2 tokens, ~1200×750, no external deps
  except none) that draws a SIMPLIFIED version of the screen — the essential layout + the one lime action.
- **Caption (on-slide):** <e.g. "Procurement — agent-drafted PO awaiting approval · sample data">
<the ```html ... ``` snippet>
```
The deck designer will place each snippet inside a light browser/device frame on the named slide.

## Rules (non-negotiable)
- **v2 tokens only:** paper `#fff`, panel `#f4f3ef`, ink `#0a0a0a`, **one lime `#c6f24f`**, success `#1f9e6f`;
  **Archivo** + **JetBrains Mono**; hairlines over shadows; dotted-grid where the app uses it; **no emoji**.
- **Simplify for a slide:** ~6–10 rows max per table, one chart, legible at slide scale (min ~16px on-screen
  ≈ readable when projected). Cut chrome that doesn't tell the story; keep the agent-trace + the approve action.
- **Anonymize + label.** No real companies/people — the narrative already uses the anonymized OEM labels
  **"Tier-1 Auto OEM" / "OEM-2"** at the source (SEED.1; no real marque anywhere in the repo or app). Every
  screen carries a small **"sample data — illustrative"** chip.
  Keep the propose→approve→audit fields visible (inputs, output, model, confidence, approver).
- **Self-contained:** each snippet renders standalone (so the deck tool can paste it). No app data calls.
- Show the **built** screens (don't fabricate modules that aren't designed).

## SEED deck — export these screens (→ slide)
1. **Procurement co-pilot** (PO queue: agent-drafted row + the approve action + trace) → Slide 3 Solution.
2. **Build genealogy** (per-serial: parts/serials/firmware as you build) → Slide 3 / Moat.
3. **Command Center** (cross-module KPI rollup + exception feed) → Slide 6 Product (shows OS breadth).
4. **Workflow run console** (agent-orchestration trace lighting up steps) → Slide 9 Moat (multi-agent).
5. **Cross-module ripple** (a quality flag cascading Quality→Eng→Procurement→Fulfillment→Field→Finance→Legal)
   → the "How it works in one story" slide. (Diagram, not a literal screen, in v2 style.)
6. **Module map grid** (Core / Value chain / Robotics / Back office) → Slide 6 / appendix.

## SALES deck — export these screens (→ slide)
1. **Procurement PO queue** (agent-drafted vs sent; approve/edit) → Slide 4 Underlying Magic.
2. **Build genealogy** → Slide 3 Value Prop ("know every unit").
3. **Quality SPC chart → NCR** (torque vs control limits; out-of-spec point) → Slide 4 / value tiles.
4. **Fleet map + Field-Service dispatch board** (uptime → SLA countdown → dispatch) → Slide 3/6.
5. **propose→approve→audit + audit trail** (the trust mechanic) → Slide 4 / Slide 6 deployment.
6. **Cross-module ripple** diagram → Slide 7 (why OS, not point tools).

## After exporting
List, at the top of each file, the screen→slide map so the deck Claude knows placement. Flag any screen
that isn't built yet as "designed, not built — render as mock" so we keep the built/designed line honest.
Then hand both files to the deck designer alongside the content + addon files.

## Note (chief-of-staff)
Treat these as **human-gate**: Nicolas reviews the anonymization + "sample data" labels before any deck
goes external — named-claim discipline applies to screens too.
