import {
  advancePurchaseOrder,
  rejectPurchaseOrder,
  receivePurchaseOrder,
} from "@/app/(shell)/procurement/actions";
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
  // RBAC.4: a human rejected the PO at the gate — terminal, rendered in ink.
  REJECTED: {
    cls: "bg-ink-strong text-on-dark",
    label: "Rejected",
    dot: null,
  },
};

const ADVANCE: Partial<Record<QueuePO["status"], string>> = {
  DRAFTED: "Submit",
  AWAITING_APPROVAL: "Approve",
  APPROVED: "Send",
};

// One template shared by the header AND every row (PO_HEADER_COLS = COLS). The
// actions column is a FIXED width reserved on all rows (empty when a row has no
// buttons) so PO · Item · Vendor · Value · Status align vertically regardless of
// the Approve/Reject buttons (UX.5). fr ratios match Procurement.dc.html.
//
// UX.16 — every track is CONTENT-INDEPENDENT, which is what kills the column
// residual. A bare `0.9fr` means `minmax(auto, 0.9fr)`: the track's floor is its
// own min-content, so a row whose value/status is wider than its ratio share
// inflates that track and steals width from its neighbours — while the header's
// short mono labels ("VALUE", "STATUS") never do. Header and rows then resolve
// DIFFERENT tracks off the same template (~23px apart at 1280px). Replacing every
// `auto` floor with `0` or a fixed px makes the resolution identical for the
// header and every row at every width. The floors are measured, not padding:
//   · PO      56px — `PO-9001` in JetBrains Mono 12.5px = 52.5px
//   · Value   76px — `$1,234,567` in JetBrains Mono 12.5px = 75px
//   · Status 112px — the widest chip, `Awaiting approval` = 109.6px (a fixed
//                    track, so no status ever reflows the row)
//   · Actions 160px — unchanged from UX.5
// Item/Vendor stay purely proportional (`minmax(0, …)`) and truncate — see the
// UX.15 rule in design.md.
// (One literal string — Tailwind scans source text, so the template must not be
// composed from parts or the arbitrary `grid-cols-[…]` never gets generated.)
const COLS =
  "grid grid-cols-[minmax(56px,0.8fr)_minmax(0,2.2fr)_minmax(0,1fr)_minmax(76px,0.9fr)_112px_160px] items-center gap-3 px-5";

function fmtDate(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString() : "—";
}

// BR.1 — a small mono flag (single-source / long-lead). Ink-on-panel hairline, no
// accent and no alarm colour — a machine-reported label, not a warning.
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-[4px] border border-line-panel bg-panel px-1.5 py-px font-mono text-[8.5px] font-semibold uppercase tracking-[0.05em] text-ink-muted">
      {children}
    </span>
  );
}

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
      {/* UX.16 — tabular-nums on every numeric/date cell so digit-width changes
          (1 vs 8, a 5- vs 7-figure value) can't jitter the column. */}
      <span className="min-w-0 truncate font-mono text-[12.5px] tabular-nums text-ink">
        {po.code}
      </span>
      <div className="min-w-0">
        {/* UX.16 — `overflow-hidden` + `shrink-0` tags: the Item track no longer
            inflates to fit the BR.1 flags (that inflation WAS the residual), so at
            cramped widths the flags clip at the track edge instead of painting over
            the Vendor column. The SKU keeps its `title` tooltip. */}
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          <span
            className="truncate text-[13.5px] tabular-nums text-ink"
            title={`${po.partSku} · qty ${po.qty}`}
          >
            {po.partSku} · qty {po.qty}
          </span>
          {po.singleSource && <Tag>Single-source</Tag>}
          {po.longLead && <Tag>Long-lead</Tag>}
        </div>
        {/* BR.1 promised-vs-actual: received date wins; else promised + a late chip. */}
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 font-mono text-[10px] tabular-nums text-ink-muted">
          {po.receivedAt ? (
            <span>Received {fmtDate(po.receivedAt)}</span>
          ) : po.eta ? (
            <>
              <span>Promised {fmtDate(po.eta)}</span>
              {po.late && (
                <span className="rounded-[4px] bg-ink-strong px-1.5 py-px text-[8.5px] font-semibold uppercase tracking-[0.05em] text-on-dark">
                  Late
                </span>
              )}
            </>
          ) : po.agentDrafted ? (
            <span>Drafted by agent</span>
          ) : (
            <span>—</span>
          )}
        </div>
      </div>
      <span
        className="min-w-0 truncate text-[13px] text-ink-muted"
        title={po.supplier}
      >
        {po.supplier}
      </span>
      <span className="min-w-0 truncate font-mono text-[12.5px] tabular-nums text-ink">
        ${po.value.toLocaleString()}
      </span>
      {/* Fixed 112px track (see COLS) — the chip is sized by its own content and
          never reflows the row, whichever of the six statuses it carries. */}
      <span className="min-w-0">
        <span
          className={`inline-flex max-w-full items-center gap-1.5 truncate rounded-pill px-[9px] py-[3px] text-[10.5px] font-semibold tracking-[0.03em] ${status.cls}`}
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
      <span className="flex items-center justify-end gap-2">
        {canApprove && po.status === "AWAITING_APPROVAL" ? (
          <form action={rejectPurchaseOrder.bind(null, po.id)}>
            <button
              type="submit"
              className="rounded-btn border border-line-strong bg-paper px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition-colors hover:border-ink-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Reject
            </button>
          </form>
        ) : null}
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
        {/* BR.1 — goods receipt (SENT → RECEIVED); bumps stock so readiness ticks up. */}
        {canApprove && po.status === "SENT" ? (
          <form action={receivePurchaseOrder.bind(null, po.id)}>
            <button
              type="submit"
              className="rounded-btn border border-line-strong bg-paper px-3 py-1.5 text-[12.5px] font-semibold text-ink transition-colors hover:border-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Receive
            </button>
          </form>
        ) : null}
      </span>
    </div>
  );
}

export const PO_HEADER_COLS = COLS;
