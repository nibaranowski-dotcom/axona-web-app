import Link from "next/link";
import type { FleetRobot, RobotTelemetry } from "@/lib/fleet";
import type { ConfigSummary } from "@/lib/units";
import { metaFor } from "./status";

// Live units table (Fleet.dc.html v8) — per-unit dot, unit (→ Unit page), uptime
// bar, the resolved Config · SW column (+ "old" when behind the latest release),
// a telemetry sparkline, and the status pill.
//
// PLM.V4: the Config · SW column is RESOLVED from the Unit spine (resolveConfig
// Summaries — the software time-series + swSpec match), never the stored
// Robot.firmware scalar; the serial links to /units/:serial (the hero object).
// (The design's "Battery" column isn't a Robot field → uptime is shown; FLEET.2.)
const COLS =
  "grid grid-cols-[14px_2fr_1.1fr_0.9fr_1.1fr_1.2fr] items-center gap-3 px-5";

function sparkPoints(points: { value: number }[]): string {
  const n = points.length;
  if (n === 0) return "0,12 100,12";
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  return points
    .map((p, i) => {
      const x = n === 1 ? 50 : (i / (n - 1)) * 100;
      const y = max === min ? 12 : 22 - ((p.value - min) / (max - min)) * 20;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function LiveUnits({
  robots,
  telemetry,
  configBySerial,
}: {
  robots: FleetRobot[];
  telemetry: RobotTelemetry[];
  configBySerial: Record<string, ConfigSummary>;
}) {
  const teleByRobot = new Map<string, RobotTelemetry>();
  for (const t of telemetry)
    if (!teleByRobot.has(t.robotId)) teleByRobot.set(t.robotId, t);

  return (
    <section
      aria-label="Live units"
      className="overflow-hidden rounded-card border border-line bg-paper"
    >
      <div className="flex items-center justify-between px-5 pb-3 pt-4">
        <h2 className="text-[15px] font-semibold text-ink">Live units</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          {robots.length} units
        </span>
      </div>
      <div
        className={`${COLS} border-t border-line py-[10px] font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted`}
      >
        <span aria-hidden />
        <span>Unit</span>
        <span>Uptime</span>
        <span>Config · SW</span>
        <span>Telemetry</span>
        <span>Status</span>
      </div>
      {robots.map((r) => {
        const meta = metaFor(r.status);
        const series = teleByRobot.get(r.id);
        const cfg = configBySerial[r.serial];
        return (
          <div
            key={r.id}
            className={`${COLS} border-t border-line py-[13px] hover:bg-panel-2`}
          >
            <span aria-hidden className={`h-2 w-2 rounded-pill ${meta.dot}`} />
            <div className="min-w-0">
              <Link
                href={`/units/${encodeURIComponent(r.serial)}`}
                className="block truncate font-mono text-[12.5px] font-semibold text-ink underline decoration-transparent underline-offset-2 transition-colors hover:decoration-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                title={r.serial}
              >
                {r.serial}
              </Link>
              <div
                className="mt-px truncate text-[11px] text-ink-muted"
                title={`${r.model} · ${r.site}`}
              >
                {r.model} · {r.site}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-[5px] w-full max-w-[52px] overflow-hidden rounded-pill bg-[var(--skeleton)]">
                <span
                  className={`block h-[5px] rounded-pill ${meta.bar}`}
                  style={{ width: `${Math.round(r.uptimePct)}%` }}
                />
              </div>
              <span className="font-mono text-[11px] text-ink-muted">
                {Math.round(r.uptimePct)}%
              </span>
            </div>
            <div className="min-w-0">
              <div className="truncate font-mono text-[11.5px] text-ink">
                {cfg?.configVersion ?? "—"}
              </div>
              <div className="flex items-center gap-[5px]">
                <span className="font-mono text-[10px] text-ink-faint">
                  {cfg?.swVersion ?? r.firmware}
                </span>
                {cfg?.isBehind && (
                  <span className="rounded-[4px] bg-accent px-1 py-px font-mono text-[8.5px] uppercase tracking-[0.04em] text-accent-ink">
                    old
                  </span>
                )}
              </div>
            </div>
            <svg
              width="100%"
              height="22"
              viewBox="0 0 100 24"
              preserveAspectRatio="none"
              aria-hidden
            >
              <polyline
                points={sparkPoints(series?.points ?? [])}
                fill="none"
                stroke={meta.spark}
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
            <span>
              <span
                className={`inline-flex items-center rounded-pill px-[9px] py-[3px] text-[10.5px] font-semibold tracking-[0.03em] ${meta.badge}`}
              >
                {meta.label}
              </span>
            </span>
          </div>
        );
      })}
    </section>
  );
}
