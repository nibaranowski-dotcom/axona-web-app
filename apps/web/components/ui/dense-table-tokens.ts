// TABLE.1 — the dense-table class tokens, deliberately in a NON-client module.
//
// `DenseTable.tsx` is `"use client"`, and Next.js forbids a server component from
// dot/index-accessing an export of a client module ("Cannot access px-5.toString on
// the server"). Several consumers (e.g. ChangeOrdersView) are server components and
// index these by padding variant, so the strings live here where both sides can
// reach them; the component keeps its own directive.

/** Row padding variants. Literal strings — Tailwind cannot see composed classes. */
export type DensePad = "px-5" | "px-[18px]";

/**
 * The frozen cell (TABLE.3a) — MECHANICS ONLY.
 *
 * A pinned column has to do exactly three things beyond being sticky, all of them
 * proven on the PO queue in UX.17, and none of them a styling choice:
 *
 *  · `self-stretch` — the row is `items-center`, so otherwise the pinned cell is one
 *    line tall and the rest of the row's content slides visibly through the band
 *    above and below it.
 *  · an OPAQUE background — content sliding underneath must be hidden. The colour is
 *    the CONSUMER's (`bg`), matching whatever its own row paints; TABLE.1 hardcoded
 *    `bg-inherit`, which silently required every adopting row to be opaque and to
 *    have been given a background it may not have had.
 *  · `-ml/pl` — `left-0` pins to the SCROLLER's edge, not the row's content box, so
 *    without restoring the row's padding the identifier jumps left on scroll and
 *    ends up touching the card border.
 *
 * Everything else — row height, striping, hover, the card — stays with the table.
 *
 * `bg` must be a literal Tailwind class the consumer also uses on its row (e.g.
 * "bg-paper"), so the pinned cell and its row always paint the same colour.
 */
export function frozenCell(pad: DensePad, bg: string): string {
  const offset = pad === "px-5" ? "-ml-5 pl-5" : "-ml-[18px] pl-[18px]";
  return `sticky left-0 z-10 ${offset} flex items-center self-stretch ${bg} group-data-[scrolled=true]:border-r group-data-[scrolled=true]:border-line`;
}

/**
 * The PO queue's frozen cell, kept as a constant so its class string is byte-stable
 * (it is the 0px-parity reference every later migration is measured against).
 */
export const FROZEN_CELL: Record<DensePad, string> = {
  "px-5": frozenCell("px-5", "bg-inherit"),
  "px-[18px]": frozenCell("px-[18px]", "bg-inherit"),
};

/**
 * TABLE.2 — a TWO-column freeze, for a table whose identifier sits behind a
 * selection checkbox (Test Explorer). Three things differ from the single-column
 * case, none of them optional:
 *
 *  · **Only the LAST frozen column draws the hairline.** One between the two would
 *    put a rule inside the pinned block, which the v2 design has nowhere.
 *  · **The `next` cell closes the grid gap.** `left` pins its BORDER box, so without
 *    `-ml/pl` the 12px gap between the two frozen tracks is transparent and the row
 *    scrolls visibly through the slot between them. With it, the two backgrounds
 *    meet and the pinned block reads as one surface.
 *  · **The lead sits above.** Both are pinned so they never overlap each other, but
 *    both must sit above the cells sliding underneath.
 *
 * The offsets are the CONSUMER's geometry, written out because Tailwind cannot see
 * a composed class: `left-[46px]` is row padding 18px + the 28px checkbox track, and
 * `-ml-3/pl-3` is the 12px `gap-3`. A table with a different leading track needs its
 * own literal entry here — not a computed string.
 */
export const FROZEN_PAIR: { lead: string; next: string } = {
  lead: "sticky left-0 z-20 -ml-[18px] pl-[18px] flex items-center self-stretch bg-inherit",
  next: "sticky left-[46px] z-10 -ml-3 pl-3 flex min-w-0 items-center self-stretch bg-inherit group-data-[scrolled=true]:border-r group-data-[scrolled=true]:border-line",
};
