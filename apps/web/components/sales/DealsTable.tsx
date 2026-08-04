import type { SalesDeal } from "@/lib/sales";
import { DELIVERABILITY, fmtMoney, titleCase } from "./format";

// Top deals with the agent-checked deliverability badge (Sales & CRM.dc.html) —
// the signature artifact. The badge is DERIVED over Fulfillment + Manufacturing
// (Tier-1 Auto OEM → DLV-3312 hold + AX-2 line hold = At risk), rendered with a dot + ink
// label (AA-safe) + the reason. Brand palette only.
const COLS =
  "grid grid-cols-[1.2fr_1.7fr_0.9fr_1fr_1.2fr] items-center gap-3 px-5";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
function closeLabel(date: Date | null): string {
  if (!date) return "—";
  const d = new Date(date);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function DealsTable({ deals }: { deals: SalesDeal[] }) {
  const sorted = [...deals].sort((a, b) => b.value - a.value);
  return (
    <section
      aria-label="Top deals"
      className="overflow-hidden rounded-card border border-line bg-paper"
    >
      <div className="flex items-center justify-between px-5 pb-3 pt-4">
        <h2 className="text-[15px] font-semibold text-ink">Top deals</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          Deliverability checked by agent
        </span>
      </div>
      <div
        className={`${COLS} border-t border-line py-[10px] font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted`}
      >
        <span>Account</span>
        <span>Configuration</span>
        <span>Value</span>
        <span>Stage</span>
        <span>Deliverable</span>
      </div>
      {sorted.map((d) => {
        const badge = DELIVERABILITY[d.deliverability];
        return (
          <div
            key={d.id}
            className={`${COLS} border-t border-line py-[13px] hover:bg-panel-2`}
          >
            <div className="min-w-0">
              <div
                className="truncate text-[13.5px] font-semibold text-ink"
                title={d.account}
              >
                {d.account}
              </div>
              <div className="mt-px font-mono text-[10px] text-ink-muted">
                Close {closeLabel(d.closeDate)}
              </div>
            </div>
            <span
              className="min-w-0 truncate text-[12.5px] text-ink-muted"
              title={d.config}
            >
              {d.config}
            </span>
            <span className="font-mono text-[12.5px] font-semibold text-ink">
              {fmtMoney(d.value)}
            </span>
            <span className="text-[12.5px] text-ink-muted">
              {titleCase(d.stage)}
            </span>
            <div className="min-w-0">
              <span className="inline-flex items-center gap-[7px] text-[11.5px] font-semibold text-ink">
                <span
                  aria-hidden
                  className={`h-[7px] w-[7px] flex-none rounded-full ${badge.dot}`}
                />
                {badge.label}
              </span>
              {d.deliverabilityReason && d.deliverability === "AT_RISK" && (
                <div className="mt-0.5 truncate font-mono text-[9.5px] text-ink-muted">
                  {d.deliverabilityReason}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
