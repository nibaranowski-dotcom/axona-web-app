import type { LineStation } from "@/lib/manufacturing";
import { LINE_STATIONS } from "@/lib/manufacturing";
import { nodeState, stationLabel, type NodeState } from "./format";

// Line-flow board — the MES signature artifact (Manufacturing.dc.html). The line
// as a horizontal station pipeline (Frame → Drive → Actuators → Firmware → Test →
// Pack); each node styled by what's sitting there (active = lime, held = ink
// square, done = ink-fill, empty = hairline), with the units at each station
// listed below. Brand palette only.
//
// Note: the model has no per-production-line grouping (the design's Line 1/2/3),
// so the plant renders as ONE station pipeline with units positioned at their
// current station (see MFG.2 notes).
const NODE: Record<NodeState, { dot: string; ring: string; label: string }> = {
  done: {
    dot: "bg-ink-strong",
    ring: "border-ink-strong",
    label: "text-ink-muted",
  },
  current: { dot: "bg-accent", ring: "border-accent", label: "text-ink" },
  blocked: { dot: "bg-paper", ring: "border-ink-strong", label: "text-ink" },
  pending: {
    dot: "bg-transparent",
    ring: "border-line-strong",
    label: "text-ink-muted",
  },
};

export function LineFlowBoard({ lineFlow }: { lineFlow: LineStation[] }) {
  const byStation = new Map(lineFlow.map((s) => [s.station, s]));
  const stations = LINE_STATIONS.map((name) => ({
    name,
    data: byStation.get(name),
    state: nodeState(byStation.get(name)),
  }));
  const lastActive = stations.reduce(
    (acc, s, i) => ((s.data?.count ?? 0) > 0 ? i : acc),
    0,
  );
  const progFrac = stations.length > 1 ? lastActive / (stations.length - 1) : 0;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-muted">
          Line flow
        </span>
        <span aria-hidden className="h-px flex-1 bg-line" />
        <span className="font-mono text-[10px] text-ink-muted">
          Frame → Drive → Actuators → Firmware → Test → Pack
        </span>
      </div>

      <div className="rounded-card border border-line bg-paper px-5 pb-4 pt-9">
        <div
          className="relative flex items-start justify-between"
          role="img"
          aria-label={`Line flow across ${stations.length} stations; ${stations
            .filter((s) => (s.data?.count ?? 0) > 0)
            .map((s) => `${stationLabel(s.name)} ${s.data?.count}`)
            .join(", ")}`}
        >
          {/* rail + progress */}
          <span
            aria-hidden
            className="absolute left-[27px] right-[27px] top-[13px] h-0.5 bg-line-strong"
          />
          <span
            aria-hidden
            className="absolute left-[27px] top-[13px] h-0.5 bg-accent"
            style={{ width: `calc((100% - 54px) * ${progFrac})` }}
          />
          {stations.map((s) => {
            const n = NODE[s.state];
            const count = s.data?.count ?? 0;
            return (
              <div
                key={s.name}
                className="relative flex min-w-[54px] flex-col items-center gap-2"
              >
                <span
                  className={`z-[1] flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 bg-paper ${n.ring}`}
                >
                  {s.state === "current" && (
                    <span className="h-2 w-2 rounded-full bg-accent" />
                  )}
                  {s.state === "blocked" && (
                    <span className="h-2 w-2 rounded-[2px] bg-ink-strong" />
                  )}
                  {s.state === "done" && (
                    <span className="h-2.5 w-2.5 rounded-full bg-ink-strong" />
                  )}
                </span>
                <span
                  className={`font-mono text-[9px] uppercase tracking-[0.03em] ${n.label}`}
                >
                  {stationLabel(s.name)}
                </span>
                <span className="font-mono text-[10px] text-ink-muted">
                  {count > 0 ? `${count} unit${count === 1 ? "" : "s"}` : "—"}
                </span>
              </div>
            );
          })}
        </div>

        {/* units at each station */}
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 border-t border-line pt-3 sm:grid-cols-3">
          {stations
            .filter((s) => (s.data?.count ?? 0) > 0)
            .map((s) => (
              <div key={s.name} className="flex items-baseline gap-2">
                <span className="font-mono text-[9px] uppercase tracking-[0.04em] text-ink-muted">
                  {stationLabel(s.name)}
                </span>
                <span className="truncate font-mono text-[11px] text-ink">
                  {s.data!.workOrders.map((w) => w.serial).join(" · ")}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
