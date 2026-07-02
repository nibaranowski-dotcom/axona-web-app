"use client";

import { Plus } from "lucide-react";
import type { FinanceData } from "@/lib/finance";
import { useUi } from "@/lib/ui-store";
import { useCopilotSeed } from "@/lib/copilot-seed";
import {
  TraceConsole,
  type TraceLine as ConsoleLine,
} from "@/components/shell/TraceConsole";
import { RevenueChart } from "./RevenueChart";
import { WorkingCapital } from "./WorkingCapital";
import { UnitEconomics } from "./UnitEconomics";
import { Receivables } from "./Receivables";
import { fmtMoney, fmtPct } from "./format";

export interface FinanceScreenData extends FinanceData {
  traceLines: { ts?: string; kind?: string; text?: string }[];
}

// The Finance & Accounting screen (FIN.2, matching Finance.dc.html on the v2
// shell): the two-revenue-engine recognition chart + working capital, then per-
// unit economics, then AR-aging receivables, then the agent trace. Read-only from
// FIN.1; the Finance agents come in the module-aware pane automatically. "Run
// month-end close" routes to the agent (proposes; the real close is a gated write
// needing a period-close model — deferred, see notes).
export function FinanceView({
  data,
  error = false,
}: {
  data: FinanceScreenData;
  error?: boolean;
}) {
  const setSeed = useCopilotSeed((s) => s.setSeed);
  const setCollapsed = useUi((s) => s.setAgentPaneCollapsed);

  const r = data.rollup;
  const grossMarginPct = r.recognizedRevenue
    ? ((r.recognizedRevenue - r.cogs) / r.recognizedRevenue) * 100
    : 0;
  const latestRaas =
    data.revenueByPeriod[data.revenueByPeriod.length - 1]?.raas ?? 0;
  const hx2 = data.unitEconomics.find((u) => u.product === "HX-2");
  const hasData = data.revenueByPeriod.length > 0 || data.invoices.length > 0;

  // Design metrics — real where derivable. Cash / runway need a treasury feed the
  // ledger doesn't carry → ARR (RaaS × 12) + Net income fill those slots; the
  // Working-capital panel replaces the design's Cash & runway card (see notes).
  const stats = [
    { v: fmtMoney(latestRaas * 12), l: "ARR · RaaS" },
    { v: fmtPct(grossMarginPct), l: "Gross margin" },
    { v: fmtMoney(r.recognizedRevenue), l: "Recognized rev" },
    { v: fmtMoney(r.netIncome), l: "Net income" },
  ];

  const trace: ConsoleLine[] = data.traceLines
    .filter((l) => l.text)
    .map((l) => ({
      ts: l.ts ? l.ts.slice(11, 19) : undefined,
      text: `${(l.kind ?? "").padEnd(12)}· ${l.text}`,
    }));

  return (
    <div className="flex h-full flex-col bg-panel">
      {/* Topbar (60px) */}
      <header className="flex h-[60px] flex-none items-center justify-between border-b border-line bg-paper px-6">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
            Back office · FY26
          </div>
          <h1 className="mt-0.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
            Finance &amp; Accounting
          </h1>
        </div>
        <div className="flex items-center gap-[14px]">
          {hx2?.marginDeltaPt != null && hx2.marginDeltaPt < 0 && (
            <span className="inline-flex items-center gap-[7px] rounded-pill border border-line-strong bg-panel px-3 py-[5px] text-[12.5px] font-semibold text-ink">
              <span
                aria-hidden
                className="h-[7px] w-[7px] rounded-full bg-accent"
              />
              HX-2 margin {hx2.marginDeltaPt}pt
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setSeed(
                "Run the month-end close: recognize revenue and review AR",
              );
              setCollapsed(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-btn bg-ink-strong px-4 py-[9px] text-[13.5px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Run month-end close
          </button>
        </div>
      </header>

      {error ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p role="status" className="text-sm text-ink-muted">
            Couldn’t load finance data. Check the database and refresh.
          </p>
        </div>
      ) : !hasData ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-sm text-ink-muted">
            No finance data — run the seed (
            <span className="font-mono">pnpm db:seed</span>).
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-6 py-[22px]">
          {/* summary strip */}
          <div className="flex overflow-hidden rounded-card border border-line bg-paper">
            {stats.map((s, i) => (
              <div
                key={s.l}
                className={`flex-1 px-[18px] py-[15px] ${i ? "border-l border-line" : ""}`}
              >
                <div className="text-[22px] font-bold tracking-[-0.03em] text-ink">
                  {s.v}
                </div>
                <div className="mt-[3px] font-mono text-[9px] uppercase tracking-[0.05em] text-ink-muted">
                  {s.l}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1.5fr_1fr]">
            <RevenueChart periods={data.revenueByPeriod} />
            <WorkingCapital rollup={data.rollup} />
          </div>

          <UnitEconomics units={data.unitEconomics} />

          <Receivables invoices={data.invoices} arTotal={data.rollup.arTotal} />

          {trace.length > 0 && (
            <TraceConsole
              lines={trace}
              title="Agent trace · fin-orchestrator"
            />
          )}
        </div>
      )}
    </div>
  );
}
