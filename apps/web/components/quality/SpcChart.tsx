import type { SpcSeries } from "@/lib/quality";

// The SPC control chart — the Quality signature artifact (Quality.dc.html). A
// lightweight inline SVG: each sample is a vertical bar over time against UCL /
// mean / LCL reference lines; out-of-control points are INK (critical = ink, per
// the brand), within-control are ink-faint. The over-UCL zone is a faint band.
export function SpcChart({ series }: { series: SpcSeries }) {
  const W = 296;
  const H = 80;
  const BASE = H - 4;
  const { ucl, lcl, mean, points, characteristic } = series;

  // Map value → y so UCL sits at y=20, mean at y=40, LCL at y=60.
  const span = ucl - mean || 1;
  const yFor = (v: number) =>
    Math.max(3, Math.min(H - 2, 40 - ((v - mean) / span) * 20));
  const n = points.length;
  const xFor = (i: number) => (n <= 1 ? W / 2 : 12 + (i * (W - 24)) / (n - 1));
  const outCount = points.filter(
    (p) => p.value > p.ucl || p.value < p.lcl,
  ).length;

  return (
    <div className="rounded-card border border-line bg-paper p-5">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink">
          Drive torque · SPC
        </h2>
        <span className="font-mono text-[10.5px] tracking-[0.04em] text-ink-muted">
          n={n} · {outCount} out of spec
        </span>
      </div>

      <div className="relative">
        <svg
          width="100%"
          height="196"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="block"
          role="img"
          aria-label={`SPC control chart for ${characteristic}: ${outCount} of ${n} samples out of control limits (UCL ${ucl}, LCL ${lcl})`}
        >
          {/* over-UCL zone */}
          <rect
            x="0"
            y="0"
            width={W}
            height="20"
            fill="var(--ink-strong)"
            opacity="0.045"
          />
          {/* UCL · mean · LCL */}
          <line
            x1="0"
            y1="20"
            x2={W}
            y2="20"
            stroke="var(--ink-strong)"
            strokeWidth="0.5"
            strokeDasharray="3 2"
          />
          <line
            x1="0"
            y1="40"
            x2={W}
            y2="40"
            stroke="var(--line-strong)"
            strokeWidth="0.5"
          />
          <line
            x1="0"
            y1="60"
            x2={W}
            y2="60"
            stroke="var(--ink-strong)"
            strokeWidth="0.5"
            strokeDasharray="3 2"
          />
          {points.map((p, i) => {
            const out = p.value > p.ucl || p.value < p.lcl;
            const y = yFor(p.value);
            return (
              <rect
                key={i}
                x={xFor(i) - 2.5}
                y={y}
                width="5"
                height={Math.max(2, BASE - y)}
                rx="1"
                fill={out ? "var(--ink-strong)" : "var(--ink-faint)"}
              />
            );
          })}
        </svg>
        <span className="absolute right-1.5 top-[25%] -translate-y-1/2 bg-paper px-1 font-mono text-[9px] text-ink">
          UCL
        </span>
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-paper px-1 font-mono text-[9px] text-ink-muted">
          x̄
        </span>
        <span className="absolute right-1.5 top-[75%] -translate-y-1/2 bg-paper px-1 font-mono text-[9px] text-ink">
          LCL
        </span>
      </div>

      <div className="mt-3 flex items-center gap-[18px] border-t border-line pt-3">
        <span className="inline-flex items-center gap-[7px] text-[12px] text-ink-muted">
          <span aria-hidden className="h-2 w-2 rounded-[2px] bg-ink-faint" />
          Within control
        </span>
        <span className="inline-flex items-center gap-[7px] text-[12px] text-ink-muted">
          <span aria-hidden className="h-2 w-2 rounded-[2px] bg-ink-strong" />
          Out of spec
        </span>
        <span className="ml-auto font-mono text-[10px] text-ink-muted">
          UCL {ucl} · x̄ {mean} · LCL {lcl} N·m
        </span>
      </div>
    </div>
  );
}
