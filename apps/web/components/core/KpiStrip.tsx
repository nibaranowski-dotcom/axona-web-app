import type { Kpi } from "@/lib/core-summary";
import { KpiTile } from "./KpiTile";

// Company header strip — the top-level KPIs across the whole company.
export function KpiStrip({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {kpis.map((k) => (
        <KpiTile key={k.key} kpi={k} />
      ))}
    </div>
  );
}
