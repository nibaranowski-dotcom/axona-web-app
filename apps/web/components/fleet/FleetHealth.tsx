import type { FleetRollup } from "@/lib/fleet";
import { HEALTH_BUCKETS } from "./status";

// Fleet-health distribution (Fleet.dc.html) — a segmented bar of the status
// buckets (Nominal / Attention / Critical / Offline) + legend + inline metrics.
export function FleetHealth({
  rollup,
  onLatestPct,
  latestFw,
}: {
  rollup: FleetRollup;
  onLatestPct: number;
  latestFw: string;
}) {
  const total = rollup.total || 1;
  const countFor = (status: string) =>
    rollup.byStatus.find((s) => s.status === status)?.count ?? 0;
  const buckets = HEALTH_BUCKETS.map((b) => ({ ...b, n: countFor(b.status) }));

  return (
    <div className="rounded-card border border-line bg-paper p-5">
      <div className="mb-[14px] flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink">Fleet health</h2>
        <span className="font-mono text-[10.5px] tracking-[0.04em] text-ink-muted">
          {rollup.avgUptimePct}% uptime · {onLatestPct}% on {latestFw}
        </span>
      </div>
      <div className="flex h-[10px] gap-0.5 overflow-hidden rounded-pill bg-[var(--skeleton)]">
        {buckets.map(
          (b) =>
            b.n > 0 && (
              <span
                key={b.bucket}
                className={b.bar}
                style={{ width: `${(b.n / total) * 100}%` }}
              />
            ),
        )}
      </div>
      <div className="mt-[13px] flex flex-wrap gap-x-5 gap-y-2">
        {buckets.map((b) => (
          <span
            key={b.bucket}
            className="inline-flex items-center gap-[7px] text-[12.5px] text-ink-muted"
          >
            <span aria-hidden className={`h-2 w-2 rounded-pill ${b.dot}`} />
            {b.bucket}
            <span className="font-mono text-[12px] font-semibold text-ink">
              {b.n}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
