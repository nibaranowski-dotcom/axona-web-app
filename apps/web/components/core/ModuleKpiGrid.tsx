import Link from "next/link";
import type { ModuleKpis } from "@/lib/core-summary";

// Per-module KPI cards — each links to its module. KPI values in JetBrains Mono;
// severity dot (critical→ink, warn→lime) shown only when it needs attention.
export function ModuleKpiGrid({ modules }: { modules: ModuleKpis[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {modules.map((m) => (
        <Link
          key={m.module}
          href={m.href}
          className="group rounded-card border border-line-panel bg-panel p-4 transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <div className="mb-2.5 flex items-center justify-between">
            <span className="font-sans text-sm font-semibold text-ink-strong">
              {m.label}
            </span>
            <span aria-hidden className="font-mono text-[12px] text-ink-muted">
              →
            </span>
          </div>
          <dl className="flex flex-col gap-1.5">
            {m.kpis.map((k) => (
              <div
                key={k.key}
                className="flex items-center justify-between gap-3"
              >
                <dt className="text-[12px] text-ink-muted">{k.label}</dt>
                <dd className="flex items-center gap-1.5">
                  {k.severity && k.severity !== "ok" && (
                    <span
                      aria-hidden
                      className={`h-1.5 w-1.5 flex-none rounded-pill ${
                        k.severity === "critical"
                          ? "bg-ink-strong"
                          : "bg-accent"
                      }`}
                    />
                  )}
                  <span className="font-mono text-[13px] font-medium text-ink-strong">
                    {k.value}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </Link>
      ))}
    </div>
  );
}
