# Website UI kit — Axona marketing homepage

A faithful, interactive recreation of the Axona marketing homepage, composed from the design-system components (`Button`, `Chip`, `Badge`, `StatChip`, `Card`, `LayerRow`, `Input`) and tokens in `../../styles.css`.

**Source of truth:** the original hi-fi prototype `Homepage.dc.html` at the project root. This kit mirrors its sections at ~1180px.

## Screens / sections
- **index.html** — the full homepage: announcement bar, sticky nav, hero (live parts counter + floating build-genealogy card), agents-at-work strip, domains (interactive chip tabs), architecture layer stack + primitives, verticals grid, closing CTA, footer.

## Interactions
- Hero "parts under management" counter ticks live (decorative).
- Domain chip row is clickable (active state moves).
- Email-capture rows use the `Input` component.

## Notes
- All logos, testimonials, counters, and product screenshots are **placeholders** — the product is pre-launch.
- Copy follows the operating-system framing (not "ERP" as the primary descriptor).
