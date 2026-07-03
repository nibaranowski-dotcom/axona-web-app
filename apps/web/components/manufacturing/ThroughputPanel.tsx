import type { Bottleneck, Throughput } from "@/lib/manufacturing";
import { stationLabel } from "./format";

// Throughput & bottlenecks (Manufacturing.dc.html right column). The design's
// "In-line tests" panel needs a test-results / quality feed the MES model doesn't
// carry, so this slot shows the derivable plant throughput + the in-progress
// bottlenecks (see MFG.2 notes). Brand palette only.
export function ThroughputPanel({
  throughput,
  bottlenecks,
}: {
  throughput: Throughput;
  bottlenecks: Bottleneck[];
}) {
  const rows = [
    { label: "Built", value: throughput.built },
    { label: "In progress", value: throughput.inProgress },
    { label: "On hold", value: throughput.onHold },
    { label: "In build", value: throughput.total },
  ];
  return (
    <div className="rounded-card border border-line bg-paper px-5 pb-3 pt-[18px]">
      <div className="mb-1.5 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">Throughput</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          Line
        </span>
      </div>
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex items-center justify-between border-t border-line py-[10px]"
        >
          <span className="text-[13.5px] text-ink">{r.label}</span>
          <span className="font-mono text-[12.5px] font-semibold text-ink">
            {r.value}
          </span>
        </div>
      ))}

      <div className="mt-3 border-t border-line pt-3">
        <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.05em] text-ink-muted">
          Bottlenecks · WIP backlog
        </div>
        {bottlenecks.length === 0 ? (
          <p className="text-[12px] text-ink-muted">No station backlog.</p>
        ) : (
          bottlenecks.slice(0, 4).map((b) => {
            const max = bottlenecks[0]?.inProgress || 1;
            return (
              <div key={b.station} className="mb-2 flex items-center gap-2.5">
                <span className="w-[70px] flex-none truncate font-mono text-[10px] text-ink-muted">
                  {stationLabel(b.station)}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-pill bg-skeleton">
                  <span
                    className="block h-2 rounded-pill bg-accent"
                    style={{ width: `${(b.inProgress / max) * 100}%` }}
                  />
                </span>
                <span className="w-5 flex-none text-right font-mono text-[11px] font-semibold text-ink">
                  {b.inProgress}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
