"use client";

import { useState } from "react";
import type { QueuePO } from "@/lib/procurement";
import { PoRow, PO_HEADER_COLS, PO_MIN_W, PO_STICKY_PO } from "./PoRow";

// The PO queue — the Procurement signature artifact (not a generic grid). Header
// + rows (code · item · vendor · value · status · action) + a real count footer.
//
// UX.17 — narrow widths scroll instead of compressing. UX.16 left the tracks
// content-independent and flush, but below a ~672px card the six tracks (incl. the
// 160px action column) have nowhere to go: Item/Vendor squeeze toward zero and the
// BR.1 flags clip. The table now carries its own minimum width and lives in a
// horizontal scroller, with the PO identifier frozen at the left edge.
//
// Breakpoint-free by design: this is one rule, not a media query. When the card is
// at least PO_MIN_W the scroller has nothing to scroll and the fr tracks resolve
// exactly as UX.16 — no scrollbar, 0px drift, byte-identical. Only below it does
// the behaviour change.
export function PoQueue({
  pos,
  canApprove,
}: {
  pos: QueuePO[];
  canApprove: boolean;
}) {
  // Drives the frozen column's hairline: it appears only once content has actually
  // slid underneath. React bails out when the boolean is unchanged, so this does
  // not re-render on every scroll event.
  const [scrolled, setScrolled] = useState(false);

  return (
    <div className="overflow-hidden rounded-card border border-line bg-paper">
      {/*
        `group` + `data-scrolled` is what the frozen column's hairline keys off
        (see STICKY_PO in PoRow). The region is focusable so it can be scrolled
        from the keyboard — a scrollable region that can't take focus is
        unreachable without a pointer — and `role`/`aria-label` give that focus
        stop a name. Deliberately NO `scroll-smooth`: leaving scroll-behaviour at
        the browser default is what honours prefers-reduced-motion; forcing smooth
        scrolling is the thing that would violate it. `ring-inset` keeps the focus
        ring inside the card's rounded clip.
      */}
      <div
        className="group overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        data-scrolled={scrolled ? "true" : "false"}
        onScroll={(e) => setScrolled(e.currentTarget.scrollLeft > 0)}
        tabIndex={0}
        role="region"
        aria-label="Purchase order queue"
      >
        <div className={PO_MIN_W}>
          {/* UX.16 — the header shares PO_HEADER_COLS with every row, and that template
              is now content-independent (see COLS in PoRow), so the two resolve to the
              same tracks at every width. The header labels also truncate so a longer
              label can never re-introduce the drift. "Action" stays sr-only: it is
              absolutely positioned, so it is not an in-flow grid item and the five
              visible labels auto-place into tracks 1–5 above the row's five cells.
              UX.17 — the header's PO cell freezes too (and carries the row's own
              background), so header and body stay locked together while scrolling. */}
          <div
            className={`${PO_HEADER_COLS} border-b border-line bg-paper py-[13px] font-mono text-[9.5px] uppercase tracking-[0.06em] text-ink-muted`}
          >
            <span className={`${PO_STICKY_PO} min-w-0`}>
              <span className="truncate">PO</span>
            </span>
            <span className="min-w-0 truncate">Item</span>
            <span className="min-w-0 truncate">Vendor</span>
            <span className="min-w-0 truncate">Value</span>
            <span className="min-w-0 truncate">Status</span>
            <span className="sr-only">Action</span>
          </div>
          {pos.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-muted">
              No purchase orders match.
            </p>
          ) : (
            pos.map((p) => <PoRow key={p.id} po={p} canApprove={canApprove} />)
          )}
        </div>
      </div>
      {/* The count sits outside the scroller: it is a single line, not a column, so
          it should stay put and keep the card's bottom edge full-width. */}
      <div className="border-t border-line px-5 py-3 font-mono text-[11px] tabular-nums text-ink-muted">
        {pos.length} purchase order{pos.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}
