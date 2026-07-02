import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { UnitEcon } from "@/lib/finance";
import { fmtMoney, fmtPct } from "./format";

// Per-unit economics (Finance.dc.html) — product · ASP · unit COGS · gross-margin
// bar · trend. A margin eroding (HX-2, ECO-318) reads ink; improving reads green
// (functional live/positive). Brand palette only.
const COLS = "grid grid-cols-[1.5fr_1fr_1fr_1fr_1.1fr] items-center gap-3 px-5";

function TrendCell({ u }: { u: UnitEcon }) {
  const d = u.marginDeltaPt;
  if (d != null && d < 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink">
        <TrendingDown className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        {u.trend}
      </span>
    );
  }
  if (d != null && d > 0) {
    // ink text (AA) · green is carried by the decorative icon (positive signal)
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink">
        <TrendingUp
          className="h-3.5 w-3.5 text-success"
          strokeWidth={2}
          aria-hidden
        />
        {u.trend}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-muted">
      <Minus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      {u.trend}
    </span>
  );
}

export function UnitEconomics({ units }: { units: UnitEcon[] }) {
  return (
    <section
      aria-label="Per-unit economics"
      className="overflow-hidden rounded-card border border-line bg-paper"
    >
      <div className="flex items-center justify-between px-5 pb-3 pt-4">
        <h2 className="text-[15px] font-semibold text-ink">
          Per-unit economics
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          By product
        </span>
      </div>
      <div
        className={`${COLS} border-t border-line py-[10px] font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted`}
      >
        <span>Product</span>
        <span>ASP</span>
        <span>Unit COGS</span>
        <span>Gross margin</span>
        <span>Trend</span>
      </div>
      {units.length === 0 ? (
        <p className="border-t border-line px-5 py-8 text-center text-sm text-ink-muted">
          No unit economics.
        </p>
      ) : (
        units.map((u) => {
          const eroding = u.marginDeltaPt != null && u.marginDeltaPt < 0;
          return (
            <div
              key={u.id}
              className={`${COLS} border-t border-line py-[13px] hover:bg-panel-2`}
            >
              <div className="min-w-0 text-[13.5px] font-semibold text-ink">
                {u.product}
              </div>
              <span className="font-mono text-[12.5px] text-ink">
                {fmtMoney(u.asp)}
              </span>
              <span className="font-mono text-[12.5px] text-ink-muted">
                {fmtMoney(u.cogs)}
              </span>
              <div className="flex items-center gap-[9px]">
                <span className="h-[7px] max-w-[90px] flex-1 overflow-hidden rounded-pill bg-skeleton">
                  <span
                    className={`block h-[7px] ${eroding ? "bg-ink-strong" : "bg-accent"}`}
                    style={{ width: `${Math.min(100, u.marginPct)}%` }}
                  />
                </span>
                <span className="font-mono text-[12px] font-semibold text-ink">
                  {fmtPct(u.marginPct)}
                </span>
              </div>
              <TrendCell u={u} />
            </div>
          );
        })
      )}
    </section>
  );
}
