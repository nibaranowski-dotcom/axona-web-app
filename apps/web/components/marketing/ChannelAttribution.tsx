import type { ChannelAttribution as ChannelData } from "@/lib/marketing";
import { channelLabel, fmtMoney } from "./format";

// Pipeline by channel (Marketing.dc.html) — sourced pipeline attributed per
// channel, the dominant channel (events) in lime. Brand palette only.
export function ChannelAttribution({ channels }: { channels: ChannelData[] }) {
  const top = Math.max(1, ...channels.map((c) => c.pipeline));
  return (
    <div className="rounded-card border border-line bg-paper p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">
          Pipeline by channel
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          Sourced
        </span>
      </div>
      {channels.map((c) => (
        <div key={c.channel} className="mb-3">
          <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
            <span className="text-ink">{channelLabel(c.channel)}</span>
            <span className="font-mono text-[11px] text-ink-muted">
              {fmtMoney(c.pipeline)} · {c.pctOfPipeline}%
            </span>
          </div>
          <div className="h-[9px] overflow-hidden rounded-[5px] bg-skeleton">
            <span
              className={`block h-[9px] ${c.dominant ? "bg-accent" : "bg-ink-faint"}`}
              style={{ width: `${Math.round((c.pipeline / top) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
