import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ModuleKpis, Severity } from "@/lib/core-summary";

// "System health" — a per-module KPI card grid (v2 CC .kpi cards). Each card:
// mono domain label + a status dot (worst severity of its KPIs), the primary KPI
// value, and a note line. The whole card links to its module. Severity dot maps
// to brand tokens only: critical→ink, warn→lime, ok→success green.
const dotClass: Record<Severity, string> = {
  critical: "bg-ink-strong",
  warn: "bg-accent",
  ok: "bg-success",
};

function worstSeverity(kpis: ModuleKpis["kpis"]): Severity {
  if (kpis.some((k) => k.severity === "critical")) return "critical";
  if (kpis.some((k) => k.severity === "warn")) return "warn";
  return "ok";
}

export function HealthGrid({ modules }: { modules: ModuleKpis[] }) {
  return (
    <div className="grid grid-cols-2 gap-[14px] sm:grid-cols-3">
      {modules.map((m) => {
        const primary = m.kpis[0];
        const secondary = m.kpis[1];
        const sev = worstSeverity(m.kpis);
        return (
          <Link
            key={m.module}
            href={m.href}
            className="group min-w-0 rounded-[12px] border border-line bg-paper p-[15px] transition-all duration-200 hover:-translate-y-0.5 hover:border-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-[9px] uppercase tracking-[0.05em] text-ink-muted">
                {m.label}
              </span>
              <span
                aria-hidden
                className={`h-[6px] w-[6px] flex-none rounded-pill ${dotClass[sev]}`}
              />
            </div>
            <div className="mt-[9px] flex items-center gap-1.5">
              <span className="text-[25px] font-bold leading-none tracking-[-0.03em] text-ink">
                {primary ? primary.value : "—"}
              </span>
              <ArrowUpRight
                className="h-3.5 w-3.5 flex-none text-ink-muted opacity-0 transition-opacity group-hover:opacity-100"
                strokeWidth={2}
                aria-hidden
              />
            </div>
            <div className="mt-[3px] truncate text-[11px] text-ink-muted">
              {primary?.label}
              {secondary ? ` · ${secondary.label} ${secondary.value}` : ""}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
