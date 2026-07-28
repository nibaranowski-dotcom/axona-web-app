"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, MessageSquare } from "lucide-react";
import type { ChangeOrderData, RolloutState } from "@/lib/change-order";
import {
  approveChangeOrder,
  requestChangesOnOrder,
} from "@/app/(shell)/changes/actions";

// PLM.9 — the Change Order (`Change Order.dc.html` 1:1 on DS.1 primitives). ECO +
// its ECR, effectivity, and the COMPUTED affected-units block (via ONT.1,
// respecting effectivity) with per-unit rollout. Review/approve routes through
// decide("eco.release") — RBAC-gated + audited. DETAIL screen → breadcrumbs.

const ROLLOUT: Record<RolloutState, { label: string; cls: string }> = {
  applied: { label: "Applied", cls: "bg-success-tint text-success" },
  pending: {
    label: "Pending",
    cls: "border border-line-panel bg-panel text-ink",
  },
  not_applicable: {
    label: "Grandfathered",
    cls: "text-ink-faint",
  },
};

const COLS = "grid grid-cols-[1.2fr_1fr_1fr_0.9fr] items-center gap-3 px-5";

export function ChangeOrderView({
  data,
  canDecide,
}: {
  data: ChangeOrderData;
  canDecide: boolean;
}) {
  const router = useRouter();
  const [stage, setStage] = useState(data.stage);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const decide = (fn: (code: string) => Promise<void>, nextStage: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await fn(data.code);
        setStage(nextStage);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Decision failed.");
      }
    });
  };

  const decided = stage === "RELEASED";
  const stageLabel =
    stage === "RELEASED"
      ? "Released"
      : stage === "REVIEW"
        ? "In review"
        : "Draft";

  return (
    <div className="flex min-h-full flex-col bg-panel">
      <header className="flex-none border-b border-line bg-paper px-6 pb-4 pt-3.5">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.05em] text-ink-faint">
            <li>
              <Link href="/engineering" className="hover:text-ink">
                Engineering
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              {/* PLM.12 — the breadcrumb now resolves to the change-orders list. */}
              <Link href="/changes" className="hover:text-ink">
                Change orders
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li className="text-ink-muted">{data.code}</li>
          </ol>
        </nav>
        <div className="mt-2.5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[20px] font-bold tracking-[-0.03em] text-ink">
                <span className="font-mono">{data.code}</span> · {data.title}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 rounded-pill px-[11px] py-1 text-[11px] font-bold tracking-[0.03em] ${
                  decided
                    ? "bg-success-tint text-success"
                    : "bg-ink-strong text-on-dark"
                }`}
              >
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 rounded-full ${decided ? "bg-success" : "bg-on-dark"}`}
                />
                {stageLabel}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
              <span>{data.changeType}</span>
              {data.changeRequestCode && (
                <>
                  <Sep />
                  <span>
                    from{" "}
                    <span className="font-mono text-[12px] text-ink">
                      {data.changeRequestCode}
                    </span>
                  </span>
                </>
              )}
              {data.effectiveFromSerial && (
                <>
                  <Sep />
                  <span>
                    applies from{" "}
                    <span className="font-mono text-[12px] text-ink">
                      {data.effectiveFromSerial}
                    </span>{" "}
                    onward
                  </span>
                </>
              )}
            </div>
          </div>
          {canDecide && !decided && (
            <div className="flex flex-none items-center gap-2.5">
              <button
                type="button"
                disabled={pending}
                onClick={() => decide(requestChangesOnOrder, "DRAFT")}
                className="inline-flex items-center gap-2 rounded-btn border border-line-strong bg-paper px-[15px] py-[9px] text-[13px] font-semibold text-ink transition-colors hover:border-ink-strong disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <MessageSquare
                  className="h-3.5 w-3.5"
                  strokeWidth={1.8}
                  aria-hidden
                />
                Request changes
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => decide(approveChangeOrder, "RELEASED")}
                className="inline-flex items-center gap-2 rounded-btn bg-ink-strong px-[15px] py-[9px] text-[13px] font-semibold text-on-dark transition-colors hover:bg-black disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Check className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
                {pending ? "…" : "Approve"}
              </button>
            </div>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-2 text-[12px] text-ink">
            {error}
          </p>
        )}
      </header>

      <div className="flex-1 px-6 pb-16 pt-5">
        <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1fr_1.4fr]">
          {/* proposal */}
          <section className="rounded-card border border-line bg-paper px-5 py-[18px]">
            <h2 className="text-[15px] font-semibold text-ink">Proposal</h2>
            {data.supersede && (
              <div className="mt-3 flex items-center gap-2.5 rounded-[10px] border border-line bg-panel px-3.5 py-3 font-mono text-[13px] text-ink">
                <span className="font-semibold">{data.supersede.from}</span>
                <span aria-hidden className="text-ink-muted">
                  →
                </span>
                <span className="font-semibold text-ink-strong">
                  {data.supersede.to}
                </span>
              </div>
            )}
            <p className="mt-3.5 text-[12.5px] leading-[1.5] text-ink-muted">
              {data.rationale ?? "No rationale recorded."}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
              <Meta
                k="Effectivity"
                v={data.effectiveFromSerial ?? "all units"}
              />
              <Meta k="From date" v={data.effectiveFromDate ?? "—"} />
              <Meta k="Rollout" v={data.rolloutStatus} />
              <Meta
                k="Applied"
                v={`${data.applied} / ${data.affected.length}`}
              />
            </dl>
          </section>

          {/* affected units — COMPUTED, respects effectivity */}
          <section className="overflow-hidden rounded-card border border-line bg-paper">
            <div className="flex items-center justify-between px-5 pb-3 pt-4">
              <div className="flex items-center gap-2.5">
                <h2 className="text-[15px] font-semibold text-ink">
                  Affected units
                </h2>
                <span className="font-mono text-[10px] text-ink-faint">
                  {data.affected.length} · {data.pending} pending
                </span>
              </div>
              <Link
                href={data.registryHref}
                className="text-[12.5px] font-semibold text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Open in registry →
              </Link>
            </div>
            <div
              className={`${COLS} border-t border-line py-[10px] font-mono text-[9px] uppercase tracking-[0.06em] text-ink-faint`}
            >
              <span>Unit</span>
              <span>Site</span>
              <span>Effectivity</span>
              <span>Rollout</span>
            </div>
            {data.affected.length === 0 ? (
              <p className="border-t border-line px-5 py-6 text-center text-sm text-ink-muted">
                No units affected.
              </p>
            ) : (
              data.affected.map((u) => {
                const r = ROLLOUT[u.rollout];
                return (
                  <div
                    key={u.serial}
                    className={`${COLS} border-t border-line py-3 hover:bg-panel-2`}
                  >
                    <Link
                      href={u.href}
                      className="truncate font-mono text-[12px] font-semibold text-ink underline decoration-transparent underline-offset-2 hover:decoration-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {u.serial}
                    </Link>
                    <span className="truncate text-[12px] text-ink-muted">
                      {u.site ?? "—"}
                    </span>
                    <span className="text-[11.5px] text-ink-muted">
                      {u.inEffectivity ? "in scope" : "grandfathered"}
                    </span>
                    <span>
                      <span
                        className={`inline-flex items-center rounded-pill px-2.5 py-[3px] text-[10.5px] font-semibold ${r.cls}`}
                      >
                        {r.label}
                      </span>
                    </span>
                  </div>
                );
              })
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Sep() {
  return (
    <span aria-hidden className="text-line-strong">
      ·
    </span>
  );
}
function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="font-mono text-[9px] uppercase tracking-[0.05em] text-ink-faint">
        {k}
      </dt>
      <dd className="mt-0.5 font-mono text-[12px] text-ink">{v}</dd>
    </div>
  );
}
