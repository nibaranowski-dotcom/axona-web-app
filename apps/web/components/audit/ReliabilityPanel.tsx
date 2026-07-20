import type { CalibrationModelData } from "@/lib/audit-trail";
import { MIN_SAMPLES } from "@axona/db";

// CONF.1 — the reliability view: the visible proof that confidence is MEASURED, not
// decorated. A compact reliability curve (stated vs. observed) + sampleSize + ECE/
// Brier, per org. Data-driven (PROSPECT.2 discipline — no hardcoded narrative): it
// reflects THIS org's own decided-proposal outcomes. Below the sample floor it says
// so honestly (uncalibrated / cold start). v2 tokens; the divergence from the y=x
// perfect-calibration diagonal is the point — shown by position, not a scary color.

export function ReliabilityPanel({
  calibration,
}: {
  calibration: CalibrationModelData | null;
}) {
  const n = calibration?.sampleSize ?? 0;
  const calibrated =
    !!calibration && n >= MIN_SAMPLES && calibration.bins.length > 0;

  // The highest-weight bin, for the plain-language read ("said ~X%, right ~Y%").
  const headline =
    calibration && calibration.bins.length > 0
      ? [...calibration.bins].sort((a, b) => b.count - a.count)[0]!
      : null;

  const W = 168;
  const H = 120;
  const pad = 8;
  const x = (v: number) => pad + v * (W - 2 * pad);
  const y = (v: number) => H - pad - v * (H - 2 * pad);

  return (
    <section
      aria-label="Confidence calibration"
      className="rounded-card border border-line bg-paper p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
            Moat · confidence calibration
          </div>
          <h2 className="mt-0.5 text-[15px] font-semibold text-ink">
            Is the agents’ confidence honest?
          </h2>
          <p className="mt-1.5 max-w-[440px] text-[12.5px] leading-[1.5] text-ink-muted">
            {calibrated && headline ? (
              <>
                When agents said{" "}
                <span className="font-mono text-ink">
                  ~{Math.round(headline.mid * 100)}%
                </span>
                , they were right{" "}
                <span className="font-mono text-ink">
                  ~{Math.round(headline.observed * 100)}%
                </span>{" "}
                of the time (n={n}). The displayed confidence is corrected to
                that observed reality.
              </>
            ) : (
              <>
                Not enough decided proposals yet to calibrate (n={n}, need{" "}
                {MIN_SAMPLES}). Confidence is shown{" "}
                <span className="text-ink">uncalibrated</span> — the raw agent
                value — until the outcomes earn a calibrated number.
              </>
            )}
          </p>
        </div>

        {/* summary stats */}
        <dl className="flex flex-none gap-5">
          {[
            { l: "Samples", v: String(n) },
            {
              l: "ECE",
              v: calibration ? calibration.ece.toFixed(3) : "—",
            },
            {
              l: "Brier",
              v: calibration ? calibration.brier.toFixed(3) : "—",
            },
          ].map((s) => (
            <div key={s.l}>
              <dd className="font-mono text-[16px] font-bold text-ink">
                {s.v}
              </dd>
              <dt className="font-mono text-[9px] uppercase tracking-[0.04em] text-ink-muted">
                {s.l}
              </dt>
            </div>
          ))}
        </dl>
      </div>

      {/* reliability curve — stated (x) vs observed (y); the diagonal is perfect */}
      {calibration && calibration.bins.length > 0 && (
        <div className="mt-4 flex items-end gap-4">
          <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="Reliability curve: stated confidence versus observed approval rate"
            className="flex-none"
          >
            {/* frame */}
            <rect
              x={pad}
              y={pad}
              width={W - 2 * pad}
              height={H - 2 * pad}
              fill="none"
              stroke="var(--line)"
            />
            {/* y = x perfect-calibration reference */}
            <line
              x1={x(0)}
              y1={y(0)}
              x2={x(1)}
              y2={y(1)}
              stroke="var(--line-strong)"
              strokeDasharray="3 3"
            />
            {/* observed points (position off the diagonal = miscalibration) */}
            <polyline
              points={calibration.bins
                .map((b) => `${x(b.mid)},${y(b.observed)}`)
                .join(" ")}
              fill="none"
              stroke="var(--ink)"
              strokeWidth={1.5}
            />
            {calibration.bins.map((b, i) => (
              <circle
                key={i}
                cx={x(b.mid)}
                cy={y(b.observed)}
                r={3 + Math.min(4, b.count / 6)}
                fill="var(--accent)"
                stroke="var(--ink-strong)"
                strokeWidth={1}
              />
            ))}
          </svg>
          <div className="mb-1 space-y-1 font-mono text-[9.5px] text-ink-muted">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-[2px] w-4 bg-ink-strong opacity-40" />
              stated = observed (perfect)
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-accent" />
              this org · dot size = sample count
            </div>
            <div className="pt-0.5 text-ink-faint">
              points below the line = over-confident
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
