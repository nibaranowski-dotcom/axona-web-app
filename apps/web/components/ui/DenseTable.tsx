"use client";

import { useState, type ReactNode } from "react";

// TABLE.1 — the dense-table mechanics, extracted from the Procurement PO queue
// (UX.15 → UX.16 → UX.17) so every dense table shares ONE implementation.
//
// This owns MECHANICS, never content: no columns, no labels, no cell markup. A
// consumer supplies its own grid template and cells; the primitive supplies the
// behaviour those three stories worked out.
//
// ── what it encapsulates ────────────────────────────────────────────────────
//
// 1. **The scroll frame** (UX.17). A card, a horizontal scroller, and an inner
//    wrapper carrying the table's own minimum width. Above that width the
//    scroller has nothing to scroll and the `fr` tracks resolve exactly as they
//    would without it — no scrollbar, no layout change. Below it the table
//    scrolls instead of compressing its flexible columns toward zero.
//
// 2. **The frozen leading column(s)** (UX.17). `FROZEN_CELL` is the class string
//    a consumer puts on its identifier cell. It is exported rather than applied
//    by a descendant selector on purpose: the five tables differ in row padding
//    AND in nesting (Test Explorer groups its rows under per-procedure headings),
//    so `[&>*>*:first-child]` would silently mis-target. Exporting the string
//    keeps ONE definition while letting each table say which cell it is.
//
// 3. **The scrolled affordance.** The hairline on the frozen column appears only
//    once `scrollLeft > 0`. A permanent border would draw a vertical rule through
//    every table at every width, and the v2 design has none.
//
// 4. **Accessibility.** The scroller is focusable with an accessible name — a
//    scrollable region that cannot take focus is unreachable without a pointer —
//    and scroll-behaviour is left at the browser default, which is what honours
//    prefers-reduced-motion (forcing `scroll-smooth` is the violation).
//
// ── what it deliberately does NOT own ───────────────────────────────────────
//
// The grid template itself. Track floors are per-table measured intrinsics (the
// widest mono code, the widest status chip), so they belong with the table that
// measured them. The primitive's contract is only that the template be
// CONTENT-INDEPENDENT — every track `minmax(0, …)`, `minmax(<floor>px, …)` or a
// fixed px, never a bare `Nfr`. A bare `Nfr` is `minmax(auto, Nfr)`, whose floor
// is the track's own min-content: rows inflate their tracks, the short header
// labels do not, and header and body drift apart off the same template (UX.16).

// ── nesting (TABLE.3a) ──────────────────────────────────────────────────────
//
// DenseTable renders ONLY the scroller and the min-width floor — never a card.
// That is the whole point: the designs disagree about where the card sits, and
// TABLE.1 proved that guessing costs pixels. The PO queue puts the card OUTSIDE
// (card > scroller > rows), so its card stays viewport-width and the rows scroll
// inside it. Unit Registry puts the scroller OUTSIDE (scroller > min-w > card), so
// its 1000px card scrolls as a unit. Both are just a matter of which side of
// <DenseTable> the consumer's card element goes:
//
//   <div className="…rounded-card…"><DenseTable …>{rows}</DenseTable></div>
//   <DenseTable …><div className="…rounded-card…">{rows}</div></DenseTable>
//
// Owning a card here would force one of those on everyone — which is exactly the
// "pure extraction, no redesign" breach TABLE.1 backed out of.
export function DenseTable({
  minWidth,
  label,
  className = "",
  children,
}: {
  /** `min-w-[Npx]` — the width below which the table scrolls instead of compressing. */
  minWidth: string;
  /** Accessible name for the focusable scroll region. */
  label: string;
  /** Extra classes for the scroll container itself. */
  className?: string;
  /** The table (and, for the scroller-outside nesting, its card). */
  children: ReactNode;
}) {
  // Drives the frozen column's hairline. React bails out when the boolean is
  // unchanged, so this does not re-render on every scroll event.
  const [scrolled, setScrolled] = useState(false);

  return (
    <div
      className={`group overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${className}`}
      data-scrolled={scrolled ? "true" : "false"}
      onScroll={(e) => setScrolled(e.currentTarget.scrollLeft > 0)}
      tabIndex={0}
      role="region"
      aria-label={label}
    >
      <div className={minWidth}>{children}</div>
    </div>
  );
}
