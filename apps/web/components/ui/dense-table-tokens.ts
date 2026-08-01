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
