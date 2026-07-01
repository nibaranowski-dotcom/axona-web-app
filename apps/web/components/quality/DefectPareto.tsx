import type { DefectParetoBar } from "@/lib/quality";

// Defect Pareto — NCR counts by defect, descending (Quality.dc.html). The top
// (worst) defect is the lime signal; the rest are neutral bars.
export function DefectPareto({ bars }: { bars: DefectParetoBar[] }) {
  const max = Math.max(1, ...bars.map((b) => b.count));
  const total = bars.reduce((s, b) => s + b.count, 0);
  return (
    <div className="rounded-card border border-line bg-paper p-5">
      <div className="mb-[14px] flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">Defect Pareto</h2>
        <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted">
          {total} defect{total === 1 ? "" : "s"}
        </span>
      </div>
      {bars.length === 0 ? (
        <p className="text-sm text-ink-muted">No defects logged.</p>
      ) : (
        bars.map((b, i) => (
          <div key={b.defect} className="mb-3 last:mb-0">
            <div className="mb-[5px] flex items-center justify-between gap-3 text-[12.5px] text-ink">
              <span className="truncate">{b.defect}</span>
              <span className="flex-none font-mono text-[11px] text-ink-muted">
                {b.count}
              </span>
            </div>
            <div className="h-[7px] overflow-hidden rounded-pill bg-[var(--skeleton)]">
              <span
                className="block h-[7px] rounded-pill"
                style={{
                  width: `${(b.count / max) * 100}%`,
                  background: i === 0 ? "var(--accent)" : "var(--ink-faint)",
                }}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}
