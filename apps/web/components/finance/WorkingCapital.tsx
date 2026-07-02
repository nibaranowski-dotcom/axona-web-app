import type { FinanceRollup } from "@/lib/finance";
import { fmtMoney } from "./format";

// Working-capital panel (Finance.dc.html right card). The design's "Cash &
// runway" needs a treasury/burn feed the ledger doesn't carry (rollup.cash /
// runwayMonths are null — flagged), so this slot shows the DERIVABLE working-
// capital view: AR open, overdue, and net income. Brand palette only.
export function WorkingCapital({ rollup }: { rollup: FinanceRollup }) {
  const overduePct = rollup.arTotal
    ? Math.min(100, Math.round((rollup.arOverdue / rollup.arTotal) * 100))
    : 0;

  return (
    <div className="flex flex-col rounded-card border border-line bg-paper p-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">Working capital</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          AR
        </span>
      </div>
      <div className="mt-2 text-[30px] font-bold leading-none tracking-[-0.03em] text-ink">
        {fmtMoney(rollup.arTotal)}
      </div>
      <div className="mt-1 text-[12px] text-ink-muted">Receivables open</div>

      <div className="relative mt-[18px] h-2.5 overflow-hidden rounded-pill bg-skeleton">
        <span
          className="absolute left-0 top-0 h-2.5 rounded-pill bg-ink-strong"
          style={{ width: `${overduePct}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-ink-muted">
        <span>{fmtMoney(rollup.arOverdue)} OVERDUE</span>
        <span>{overduePct}% OF AR</span>
      </div>

      <div className="mt-auto flex items-start gap-2 border-t border-line pt-[14px]">
        <span
          aria-hidden
          className="mt-[5px] h-1.5 w-1.5 flex-none rounded-pill bg-accent"
        />
        <span className="text-[12px] leading-[1.4] text-ink-muted">
          Net income {fmtMoney(rollup.netIncome)} this window · cash &amp;
          runway pending a treasury feed.
        </span>
      </div>
    </div>
  );
}
