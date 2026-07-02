import type { LegalObligation } from "@/lib/legal";
import { obligationBadge, titleCase } from "./format";

// Contract obligations vs live ops (Legal.dc.html) — every committed SLA/warranty
// checked against what the operation is actually doing. BMW 99.5% SLA reads
// at-risk in ink (the autonomy regression). Brand palette only.
export function ObligationsPanel({
  obligations,
}: {
  obligations: LegalObligation[];
}) {
  return (
    <div className="rounded-card border border-line bg-paper p-5">
      <div className="mb-1.5 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">
          Contract obligations
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          Tracked vs live ops
        </span>
      </div>
      <p className="mb-3.5 text-[12px] text-ink-muted">
        Every committed SLA, warranty, and delivery date checked against what
        the operation is actually doing.
      </p>
      {obligations.length === 0 ? (
        <p className="border-t border-line pt-3 text-sm text-ink-muted">
          No tracked obligations.
        </p>
      ) : (
        obligations.map((o) => (
          <div
            key={o.id}
            className="flex items-center justify-between gap-[10px] border-t border-line py-[11px]"
          >
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-ink">
                {o.account}
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-ink-muted">
                {o.obligation}
              </div>
            </div>
            <div className="flex-none text-right">
              <span
                className={`inline-flex items-center rounded-pill px-[9px] py-[3px] text-[10.5px] font-semibold tracking-[0.03em] ${obligationBadge(o.state)}`}
              >
                {titleCase(o.state)}
              </span>
              <div className="mt-[5px] font-mono text-[10px] text-ink-muted">
                {o.actual}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
