"use client";

import type { QueuePO } from "@/lib/procurement";
import { DenseTable } from "@/components/ui";
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
  return (
    <div className="overflow-hidden rounded-card border border-line bg-paper">
      <DenseTable minWidth={PO_MIN_W} label="Purchase order queue">
        {/* UX.16 — the header shares PO_HEADER_COLS with every row, and that template
            is content-independent (see COLS in PoRow), so the two resolve to the same
            tracks at every width. The header labels also truncate so a longer label
            can never re-introduce the drift. "Action" stays sr-only: it is absolutely
            positioned, so it is not an in-flow grid item and the five visible labels
            auto-place into tracks 1–5 above the row's five cells. UX.17 — the header's
            PO cell freezes too, so header and body stay locked while scrolling. */}
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
      </DenseTable>
      {/* The count sits outside the scroller: it is a single line, not a column, so
          it should stay put and keep the card's bottom edge full-width. */}
      <div className="border-t border-line px-5 py-3 font-mono text-[11px] tabular-nums text-ink-muted">
        {pos.length} purchase order{pos.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}
