import type { MarketingCampaign } from "@/lib/marketing";
import { campaignStatus, channelLabel, fmtMoney } from "./format";

// Campaigns (Marketing.dc.html) — campaign · channel · MQLs · pipeline · ROI ·
// status. The underperforming paid campaign reads ink (ROI + status) per the
// brand palette (no warning hue).
const COLS =
  "grid grid-cols-[1.9fr_0.9fr_0.8fr_1fr_0.8fr_1fr] items-center gap-3 px-5";

export function CampaignsTable({
  campaigns,
}: {
  campaigns: MarketingCampaign[];
}) {
  const active = campaigns.filter(
    (c) => c.status.toUpperCase() === "ACTIVE",
  ).length;
  return (
    <section
      aria-label="Campaigns"
      className="overflow-hidden rounded-card border border-line bg-paper"
    >
      <div className="flex items-center justify-between px-5 pb-3 pt-4">
        <h2 className="text-[15px] font-semibold text-ink">Campaigns</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          {active} active
        </span>
      </div>
      <div
        className={`${COLS} border-t border-line py-[10px] font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted`}
      >
        <span>Campaign</span>
        <span>Channel</span>
        <span>MQLs</span>
        <span>Pipeline</span>
        <span>ROI</span>
        <span>Status</span>
      </div>
      {campaigns.map((c) => {
        const badge = campaignStatus(c);
        return (
          <div
            key={c.id}
            className={`${COLS} border-t border-line py-[13px] hover:bg-panel-2`}
          >
            <span
              className="truncate text-[13.5px] font-medium text-ink"
              title={c.name}
            >
              {c.name}
            </span>
            <span className="text-[12.5px] text-ink-muted">
              {channelLabel(c.channel)}
            </span>
            <span className="font-mono text-[12.5px] text-ink">{c.mqls}</span>
            <span className="font-mono text-[12.5px] font-semibold text-ink">
              {fmtMoney(c.pipeline)}
            </span>
            <span
              className={`font-mono text-[12.5px] ${c.underperforming ? "font-semibold text-ink-strong" : "text-ink"}`}
            >
              {c.roi.toFixed(1)}×
            </span>
            <span>
              <span
                className={`inline-flex items-center rounded-pill px-[9px] py-[3px] text-[10.5px] font-semibold tracking-[0.03em] ${badge.cls}`}
              >
                {badge.label}
              </span>
            </span>
          </div>
        );
      })}
    </section>
  );
}
