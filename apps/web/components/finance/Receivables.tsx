import type { FinanceInvoice } from "@/lib/finance";
import { AGING_BADGE, agingLabel, fmtMoney } from "./format";

// Receivables / AR aging (Finance.dc.html) — invoice · account·source · amount ·
// terms · aging pill (overdue = ink, due-soon = lime, current = neutral-green).
// BMW net-60 (not due) + Kawasaki overdue surface here. Brand palette only.
const COLS =
  "grid grid-cols-[1fr_1.4fr_1fr_0.9fr_1.1fr] items-center gap-3 px-5";

export function Receivables({
  invoices,
  arTotal,
}: {
  invoices: FinanceInvoice[];
  arTotal: number;
}) {
  const now = Date.now();
  return (
    <section
      aria-label="Receivables"
      className="overflow-hidden rounded-card border border-line bg-paper"
    >
      <div className="flex items-center justify-between px-5 pb-3 pt-4">
        <h2 className="text-[15px] font-semibold text-ink">Receivables</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          {fmtMoney(arTotal)} open
        </span>
      </div>
      <div
        className={`${COLS} border-t border-line py-[10px] font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted`}
      >
        <span>Invoice</span>
        <span>Account · Source</span>
        <span>Amount</span>
        <span>Terms</span>
        <span>Aging</span>
      </div>
      {invoices.length === 0 ? (
        <p className="border-t border-line px-5 py-8 text-center text-sm text-ink-muted">
          No open receivables.
        </p>
      ) : (
        invoices.map((iv) => {
          const aging = agingLabel(iv, now);
          return (
            <div
              key={iv.id}
              className={`${COLS} border-t border-line py-[13px] hover:bg-panel-2`}
            >
              <span className="font-mono text-[12px] text-ink">{iv.code}</span>
              <div className="min-w-0">
                <div className="truncate text-[13px] text-ink">
                  {iv.account}
                </div>
                <div className="mt-px truncate font-mono text-[10px] text-ink-muted">
                  {iv.source}
                </div>
              </div>
              <span className="font-mono text-[12.5px] font-semibold text-ink">
                {fmtMoney(iv.amount)}
              </span>
              <span className="font-mono text-[11.5px] text-ink-muted">
                {iv.terms}
              </span>
              <span>
                <span
                  className={`inline-flex items-center rounded-pill px-[9px] py-[3px] text-[10.5px] font-semibold tracking-[0.03em] ${AGING_BADGE[aging.tone]}`}
                >
                  {aging.text}
                </span>
              </span>
            </div>
          );
        })
      )}
    </section>
  );
}
