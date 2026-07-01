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
      <div
        className={`${PO_HEADER_COLS} border-b border-line py-[13px] font-mono text-[9.5px] uppercase tracking-[0.06em] text-ink-muted`}
      >
        <span>PO</span>
        <span>Item</span>
        <span>Vendor</span>
        <span>Value</span>
        <span>Status</span>
        <span className="sr-only">Action</span>
      </div>
      {pos.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-ink-muted">
          No purchase orders match.
        </p>
      ) : (
        pos.map((p) => <PoRow key={p.id} po={p} canApprove={canApprove} />)
      )}
      <div className="border-t border-line px-5 py-3 font-mono text-[11px] text-ink-muted">
        {pos.length} purchase order{pos.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}
