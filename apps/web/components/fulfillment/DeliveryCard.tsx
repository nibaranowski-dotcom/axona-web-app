import { DELIVERY_STAGES, type Delivery } from "@/lib/fulfillment";

// One delivery on the pipeline — the Fulfillment signature artifact
// (Fulfillment.dc.html). A 7-station track ALLOC → ACTIVE: passed nodes are ink,
// the current node is accent-ringed, a blocked node (at-risk / hold) is ink with
// a cut-out square, pending nodes are hairline. The progress fill is ink when at
// risk (critical), lime otherwise. Brand palette only.
const STATION_LABELS = [
  "Alloc",
  "Crate",
  "Freight",
  "Customs",
  "On-site",
  "Commiss",
  "Active",
];

function fmt(dt: Date): string {
  return new Date(dt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function DeliveryCard({ d }: { d: Delivery }) {
  const idx = DELIVERY_STAGES.indexOf(d.stage);
  const last = DELIVERY_STAGES.length - 1;
  const progFrac = idx / last;
  const delivered = d.stage === "ACTIVE";

  const badge = d.atRisk
    ? { cls: "bg-accent text-accent-ink", label: "At risk", dot: "" }
    : delivered
      ? {
          cls: "bg-panel text-ink-muted",
          label: "Delivered",
          dot: "bg-ink-faint",
        }
      : {
          cls: "bg-success-tint text-ink",
          label: "On track",
          dot: "bg-success",
        };

  return (
    <div className="rounded-card border border-line bg-paper px-5 pb-[18px] pt-4 transition-colors hover:border-line-strong">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-[10px]">
            <span className="font-mono text-[13px] font-semibold text-ink">
              {d.code}
            </span>
            <span className="truncate text-[13px] text-ink">{d.account}</span>
          </div>
          <div className="mt-[3px] font-mono text-[10.5px] text-ink-muted">
            {d.units} · {d.destination}
          </div>
        </div>
        <div className="flex-none text-right">
          <span
            className={`inline-flex items-center gap-1.5 rounded-pill px-[9px] py-[3px] text-[10.5px] font-semibold tracking-[0.03em] ${badge.cls}`}
          >
            {badge.dot && (
              <span
                aria-hidden
                className={`h-[6px] w-[6px] rounded-pill ${badge.dot}`}
              />
            )}
            {badge.label}
          </span>
          <div className="mt-1.5 font-mono text-[10px] text-ink-muted">
            {delivered
              ? `Activated ${fmt(d.etaDate)}`
              : `Commit ${fmt(d.committedDate)} · ETA ${fmt(d.etaDate)}`}
          </div>
        </div>
      </div>

      {/* 7-station track */}
      <div className="relative mt-3 flex items-start justify-between">
        <span
          aria-hidden
          className="absolute left-5 right-5 top-[7px] h-0.5 -translate-y-1/2 bg-line-strong"
        />
        <span
          aria-hidden
          className={`absolute left-5 top-[7px] h-0.5 -translate-y-1/2 ${d.atRisk ? "bg-ink-strong" : "bg-accent"}`}
          style={{ width: `calc((100% - 40px) * ${progFrac})` }}
        />
        {STATION_LABELS.map((label, i) => {
          const state =
            i < idx
              ? "passed"
              : i === idx
                ? d.atRisk
                  ? "blocked"
                  : delivered
                    ? "passed"
                    : "current"
                : "pending";
          const node =
            state === "passed" || state === "blocked"
              ? "border-ink-strong bg-ink-strong"
              : state === "current"
                ? "border-accent bg-paper"
                : "border-line-strong bg-paper";
          const labelColor =
            state === "current" || state === "blocked"
              ? "text-ink"
              : "text-ink-muted";
          return (
            <div
              key={label}
              className="relative z-10 flex min-w-[40px] flex-col items-center gap-[7px]"
            >
              <span
                className={`flex h-3.5 w-3.5 items-center justify-center rounded-pill border-2 ${node}`}
              >
                {state === "blocked" && (
                  <span
                    aria-hidden
                    className="h-[5px] w-[5px] rounded-[1px] bg-paper"
                  />
                )}
              </span>
              <span
                className={`font-mono text-[8px] uppercase tracking-[0.02em] ${labelColor}`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
