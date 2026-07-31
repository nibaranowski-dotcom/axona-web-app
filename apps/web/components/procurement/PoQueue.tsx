import type { QueuePO } from "@/lib/procurement";
import { PoRow, PO_HEADER_COLS } from "./PoRow";

// The PO queue — the Procurement signature artifact (not a generic grid). Header
// + rows (code · item · vendor · value · status · action) + a real count footer.
export function PoQueue({
  pos,
  canApprove,
}: {
  pos: QueuePO[];
  canApprove: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-paper">
      {/* UX.16 — the header shares PO_HEADER_COLS with every row, and that template
          is now content-independent (see COLS in PoRow), so the two resolve to the
          same tracks at every width. The header labels also truncate so a longer
          label can never re-introduce the drift. "Action" stays sr-only: it is
          absolutely positioned, so it is not an in-flow grid item and the five
          visible labels auto-place into tracks 1–5 above the row's five cells. */}
      <div
        className={`${PO_HEADER_COLS} border-b border-line py-[13px] font-mono text-[9.5px] uppercase tracking-[0.06em] text-ink-muted`}
      >
        <span className="min-w-0 truncate">PO</span>
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
      <div className="border-t border-line px-5 py-3 font-mono text-[11px] tabular-nums text-ink-muted">
        {pos.length} purchase order{pos.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}
