import { advancePurchaseOrder } from "@/app/(shell)/procurement/actions";
import type { QueuePO } from "@/lib/procurement";

// One PO-queue row (matches Procurement.dc.html columns). Status pill: functional
// green (dot + tint) for approved/sent/received, lime for awaiting attention,
// neutral for drafted — no invented reds. The approve/advance button (role-gated)
// runs the server action; only a human moves a PO forward (agent never sends).
const STATUS: Record<
  QueuePO["status"],
  { cls: string; label: string; dot: string | null }
> = {
  DRAFTED: { cls: "bg-panel text-ink-muted", label: "Drafted", dot: null },
  AWAITING_APPROVAL: {
    cls: "bg-accent text-accent-ink",
    label: "Awaiting approval",
    dot: null,
  },
  APPROVED: {
    cls: "bg-success-tint text-ink-strong",
    label: "Approved",
    dot: "bg-success",
  },
  SENT: {
    cls: "bg-success-tint text-ink-strong",
    label: "Sent",
    dot: "bg-success",
  },
  RECEIVED: {
    cls: "bg-success-tint text-ink-strong",
    label: "Received",
    dot: "bg-success",
  },
};

const ADVANCE: Partial<Record<QueuePO["status"], string>> = {
  DRAFTED: "Submit",
  AWAITING_APPROVAL: "Approve",
  APPROVED: "Send",
};

const COLS =
  "grid grid-cols-[0.8fr_2.2fr_1fr_0.9fr_1.1fr_auto] items-center gap-3 px-5";

export function PoRow({
  po,
  canApprove,
}: {
  po: QueuePO;
  canApprove: boolean;
}) {
  const status = STATUS[po.status];
  const advanceLabel = ADVANCE[po.status];
  return (
    <div className={`${COLS} border-t border-line py-[14px] hover:bg-panel-2`}>
      <span className="font-mono text-[12.5px] text-ink">{po.code}</span>
      <div className="min-w-0">
        <div className="truncate text-[13.5px] text-ink">
          {po.partSku} · qty {po.qty}
        </div>
        <div className="mt-0.5 font-mono text-[10px] text-ink-muted">
          {po.agentDrafted
            ? "Drafted by agent"
            : po.eta
              ? `ETA ${new Date(po.eta).toLocaleDateString()}`
              : "—"}
        </div>
      </div>
      <span className="truncate text-[13px] text-ink-muted">{po.supplier}</span>
      <span className="font-mono text-[12.5px] text-ink">
        ${po.value.toLocaleString()}
      </span>
      <span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-pill px-[9px] py-[3px] text-[10.5px] font-semibold tracking-[0.03em] ${status.cls}`}
        >
          {status.dot && (
            <span
              aria-hidden
              className={`h-[6px] w-[6px] rounded-pill ${status.dot}`}
            />
          )}
          {status.label}
        </span>
      </span>
      <span className="justify-self-end">
        {canApprove && advanceLabel ? (
          <form action={advancePurchaseOrder.bind(null, po.id)}>
            <button
              type="submit"
              className="rounded-btn border border-line-strong bg-paper px-3 py-1.5 text-[12.5px] font-semibold text-ink transition-colors hover:border-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {advanceLabel}
            </button>
          </form>
        ) : null}
      </span>
    </div>
  );
}

export const PO_HEADER_COLS = COLS;
