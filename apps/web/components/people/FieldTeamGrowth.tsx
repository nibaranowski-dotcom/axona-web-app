import type { PeopleRequisition } from "@/lib/people";

// Field team vs fleet growth (People.dc.html) — each function's fill vs plan.
// A role near plan reads ink; one behind reads lime (attention). Brand palette
// only.
export function FieldTeamGrowth({
  requisitions,
}: {
  requisitions: PeopleRequisition[];
}) {
  return (
    <div className="rounded-card border border-line bg-paper p-5">
      <div className="mb-1.5 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">
          Field team vs fleet growth
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          Ratio target 1:4
        </span>
      </div>
      <p className="mb-3.5 text-[12px] text-ink-muted">
        Certified techs must scale with deployed units — hiring is tracked ahead
        of fleet growth.
      </p>
      {requisitions.map((r) => {
        const pct = r.target ? Math.min(100, (r.filled / r.target) * 100) : 0;
        const behind = pct < 85;
        return (
          <div key={r.id} className="mb-3">
            <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
              <span className="text-ink">{r.role}</span>
              <span className="font-mono text-[11px] text-ink-muted">
                {r.filled} / {r.target}
              </span>
            </div>
            <div className="h-[9px] overflow-hidden rounded-[5px] bg-skeleton">
              <span
                className={`block h-[9px] ${behind ? "bg-accent" : "bg-ink-strong"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
