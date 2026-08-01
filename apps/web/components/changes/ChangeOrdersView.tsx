import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type {
  ChangeOrdersResult,
  ChangeRow,
  ChangeStatus,
} from "@/lib/change-orders";

// PLM.12 — the Change Orders list (`Change Orders.dc.html` 1:1 on DS.1 primitives).
// The change queue: a stat strip (awaiting-me + counts by status), server-side filters
// (status × type × awaiting-me, composed via the URL — no client filtering), and a
// status-led table. Rows ROUTE to the detail (no inline approval). v2 tokens · no emoji
// · no invented reds (approved/released green; everything else ink).

const STATUS_PILL: Record<ChangeStatus, string> = {
  released: "bg-success-tint text-success",
  approved: "bg-success-tint text-success",
  in_review: "bg-accent text-accent-ink",
  draft: "border border-line-panel bg-panel text-ink-muted",
};

// CHG.1 — tracks verbatim from `Change Orders.dc.html`:
//   minmax(84px,0.9fr) minmax(180px,2.1fr) 100px 112px 84px 108px 118px
// The Approval track is now a fixed 118px (it was `1fr`, resolving to ~63px against
// 126px of dual-approver content — i.e. it clipped). The design also gives the table
// a 878px minimum and makes the card scroll horizontally rather than compress.
const COLS =
  "grid grid-cols-[minmax(84px,0.9fr)_minmax(180px,2.1fr)_100px_112px_84px_108px_118px] items-center gap-3 px-5";
const CHANGES_MIN_W = "min-w-[878px]";

/**
 * CHG.1 — the approval chip, replacing the avatar stack + prose that clipped.
 * Count and state come from the REAL approval records on the row: `reviewers`
 * carries one entry per required approver with its own `approved` flag, so
 * granted/required is a straight read, never a fabricated number.
 */
function approvalChip(row: ChangeRow): {
  count: string;
  state: string;
  cls: string;
} {
  const required = row.reviewers.length;
  const granted = row.reviewers.filter((r) => r.approved).length;
  const state =
    row.status === "approved" || row.status === "released"
      ? "APPROVED"
      : row.status === "draft"
        ? "DRAFT"
        : "PENDING";
  // apChip() in the .dc.html: approved/released -> success on success-tint;
  // review -> ink on panel; draft -> ink-muted on panel.
  const cls =
    state === "APPROVED"
      ? "bg-success-tint text-success"
      : state === "DRAFT"
        ? "bg-panel text-ink-muted"
        : "bg-panel text-ink";
  return { count: `${granted}/${required}`, state, cls };
}

/** Build a /changes URL with the given filter params (server-side compose). */
function href(params: {
  status?: ChangeStatus;
  type?: string;
  awaiting?: boolean;
}): string {
  const sp = new URLSearchParams();
  if (params.awaiting) sp.set("awaiting", "me");
  if (params.status) sp.set("status", params.status);
  if (params.type) sp.set("type", params.type);
  const q = sp.toString();
  return q ? `/changes?${q}` : "/changes";
}

export function ChangeOrdersView({
  data,
  active,
}: {
  data: ChangeOrdersResult;
  active: { status?: ChangeStatus; type?: string; awaiting?: boolean };
}) {
  const { stats } = data;

  const tiles: {
    n: number;
    label: string;
    dot?: string;
    highlight?: boolean;
    to: string;
  }[] = [
    {
      n: stats.awaitingMe,
      label: "Awaiting your approval",
      dot: "bg-accent",
      highlight: true,
      to: href({ awaiting: true }),
    },
    { n: stats.draft, label: "Draft", to: href({ status: "draft" }) },
    {
      n: stats.inReview,
      label: "In review",
      to: href({ status: "in_review" }),
    },
    {
      n: stats.approved,
      label: "Approved",
      dot: "bg-success",
      to: href({ status: "approved" }),
    },
    { n: stats.released, label: "Released", to: href({ status: "released" }) },
  ];

  const chips: {
    label: string;
    count: number;
    activeChip: boolean;
    to: string;
  }[] = [
    {
      label: "All",
      count: stats.total,
      activeChip: !active.status && !active.type && !active.awaiting,
      to: href({}),
    },
    {
      label: "Awaiting me",
      count: stats.awaitingMe,
      activeChip: !!active.awaiting,
      to: href({ awaiting: true }),
    },
    {
      label: "In review",
      count: stats.inReview,
      activeChip: active.status === "in_review",
      to: href({ status: "in_review" }),
    },
    {
      label: "Supersede",
      count: 0,
      activeChip: active.type === "SUPERSEDE",
      to: href({ type: "SUPERSEDE" }),
    },
    {
      label: "Deviation",
      count: 0,
      activeChip: active.type === "DEVIATION",
      to: href({ type: "DEVIATION" }),
    },
  ];

  return (
    <div className="flex min-h-full flex-col bg-panel">
      {/* topbar */}
      <header className="flex h-[60px] flex-none items-center justify-between border-b border-line bg-paper px-6">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-faint">
            Engineering · PLM · change orders
          </div>
          <h1 className="mt-0.5 flex items-center gap-2.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
            <Link
              href="/engineering"
              title="Back to Engineering"
              aria-label="Back to Engineering"
              className="inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-md border border-line-strong text-ink-muted hover:border-ink-strong hover:text-ink"
            >
              <ArrowLeft size={15} strokeWidth={1.9} />
            </Link>
            Change orders
          </h1>
        </div>
        <div className="flex items-center gap-2.5">
          {/* Raise-a-change is a stub affordance — creation flow is a later story. */}
          <span className="rounded-lg border border-ink-strong bg-ink-strong px-3.5 py-2 text-[13px] font-semibold text-paper">
            Raise a change
          </span>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
        {/* stat strip */}
        <div className="grid flex-none grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {tiles.map((t) => (
            <Link
              key={t.label}
              href={t.to}
              className={`rounded-card border bg-paper px-4 py-3.5 hover:border-ink-strong ${t.highlight ? "border-ink-strong" : "border-line"}`}
            >
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[26px] font-bold leading-none tracking-[-0.03em] text-ink">
                  {t.n}
                </span>
                {t.dot && (
                  <span
                    className={`h-[7px] w-[7px] flex-none rounded-full ${t.dot}`}
                  />
                )}
              </div>
              <div className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.05em] text-ink-faint">
                {t.label}
              </div>
            </Link>
          ))}
        </div>

        {/* filters (server-side, composed via the URL) */}
        <div className="flex flex-none flex-wrap items-center gap-2.5">
          {chips.map((c) => (
            <Link
              key={c.label}
              href={c.to}
              aria-current={c.activeChip ? "true" : undefined}
              className={`inline-flex items-center gap-2 rounded-pill px-3 py-1.5 text-[12.5px] font-medium ${
                c.activeChip
                  ? "border border-ink-strong bg-ink-strong text-paper"
                  : "border border-line-strong bg-paper text-ink-muted hover:border-ink-strong hover:text-ink"
              }`}
            >
              {c.label}
              {c.count > 0 && (
                <span className="font-mono text-[10.5px] opacity-70">
                  {c.count}
                </span>
              )}
            </Link>
          ))}
          <span className="ml-auto font-mono text-[11px] text-ink-faint">
            {data.total} {data.total === 1 ? "CHANGE" : "CHANGES"}
          </span>
        </div>

        {/* change queue */}
        <div className="flex-none overflow-y-hidden overflow-x-auto rounded-card border border-line bg-paper">
          <div
            className={`${COLS} ${CHANGES_MIN_W} border-b border-line py-2.5 font-mono text-[9px] uppercase tracking-[0.06em] text-ink-faint`}
          >
            <span>Code</span>
            <span>Change</span>
            <span>Type</span>
            <span>Status</span>
            <span>Units</span>
            <span>Effectivity</span>
            <span>Approval</span>
          </div>
          {data.rows.length === 0 ? (
            <p className="px-5 py-12 text-center text-[13px] text-ink-muted">
              No change orders yet — raised changes will queue here.
            </p>
          ) : (
            data.rows.map((e) => <ChangeQueueRow key={e.code} e={e} />)
          )}
        </div>
      </div>
    </div>
  );
}

function ChangeQueueRow({ e }: { e: ChangeRow }) {
  const ap = approvalChip(e);
  return (
    <Link
      href={e.href}
      className={`${COLS} ${CHANGES_MIN_W} border-b border-line py-3 hover:bg-panel`}
    >
      <span className="font-mono text-[12.5px] font-semibold text-ink">
        {e.code}
      </span>
      <div className="min-w-0">
        <div
          className={`truncate text-[13px] ${e.awaitingMe ? "font-semibold text-ink" : "text-ink"}`}
        >
          {e.title}
        </div>
        {(e.agentDrafted || e.source) && (
          <div className="mt-0.5 flex items-center gap-2">
            {e.agentDrafted && (
              <span className="inline-flex items-center gap-1 rounded-[5px] border border-line-panel bg-panel px-1.5 py-px font-mono text-[9px] tracking-[0.03em] text-ink-muted">
                AGENT-DRAFTED
                {e.confidence != null &&
                  ` · ${Math.round(e.confidence * 100)}%`}
              </span>
            )}
            {e.source && (
              <span className="font-mono text-[10px] text-ink-faint">
                {e.source}
              </span>
            )}
          </div>
        )}
      </div>
      <span>
        <span className="rounded-[5px] border border-line-panel bg-panel px-1.5 py-0.5 font-mono text-[9px] tracking-[0.04em] text-ink-muted">
          {e.changeClass}
        </span>
      </span>
      <span>
        <span
          className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[10.5px] font-semibold tracking-[0.03em] ${STATUS_PILL[e.status]}`}
        >
          {e.statusLabel}
        </span>
      </span>
      <span
        className={`font-mono text-[12.5px] font-semibold ${e.heavyImpact ? "text-ink-strong" : "text-ink"}`}
      >
        {e.affectedUnits}
      </span>
      <span className="font-mono text-[11px] text-ink-muted">
        {e.effectivity}
      </span>
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={`inline-flex items-center gap-[6px] whitespace-nowrap rounded-pill px-[9px] py-[3px] font-mono text-[10px] font-semibold tracking-[0.03em] ${ap.cls}`}
        >
          <span className="font-bold">{ap.count}</span>
          {ap.state}
        </span>
      </div>
    </Link>
  );
}
