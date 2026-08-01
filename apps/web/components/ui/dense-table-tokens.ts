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
 * The frozen cell, per row-padding variant. Put this on the identifier cell.
 *
 * `self-stretch` — the row is `items-center`, so without it the pinned cell is
 * only as tall as one line of text and content slides visibly through the band
 * above and below it.
 * `bg-inherit` — not a fixed token: the pinned cell must follow the row through
 * `hover:bg-panel-2` instead of punching a paper-coloured hole in the hover state.
 * The consumer's row therefore needs an explicit opaque background.
 * `-ml/pl` — `left-0` pins to the SCROLLER's edge, not the row's content box, so
 * without restoring the row's padding the identifier jumps left on scroll and ends
 * up touching the card border. The negative margin widens the cell's box back over
 * that padding strip; the padding puts the text back. Tracks are fixed-width, so
 * neither the sizing nor the cell's right edge moves.
 */
export const FROZEN_CELL: Record<DensePad, string> = {
  "px-5":
    "sticky left-0 z-10 -ml-5 flex items-center self-stretch bg-inherit pl-5 group-data-[scrolled=true]:border-r group-data-[scrolled=true]:border-line",
  "px-[18px]":
    "sticky left-0 z-10 -ml-[18px] flex items-center self-stretch bg-inherit pl-[18px] group-data-[scrolled=true]:border-r group-data-[scrolled=true]:border-line",
};

/**
 * A SECOND frozen cell, for a table whose identifier is not the first column.
 * Test Explorer leads with a 15px selection checkbox and carries the run code in
 * column 2; pinning only column 2 is incoherent (the checkbox would scroll under
 * it) and reordering would diverge from `Test Explorer.dc.html`. `left-0` is
 * replaced by an offset equal to the first track plus the gap.
 */
export const FROZEN_CELL_2ND: Record<string, string> = {
  // 28px track + 12px gap = 40px, on an 18px-padded row
  "40px/px-[18px]":
    "sticky left-[40px] z-10 flex items-center self-stretch bg-inherit pr-2 group-data-[scrolled=true]:border-r group-data-[scrolled=true]:border-line",
};
