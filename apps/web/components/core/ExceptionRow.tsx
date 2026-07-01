import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Exception, Severity } from "@/lib/core-summary";

// One cross-module exception, as a v2 "needs attention" alert card: a vertical
// severity bar + title (links to the source object) + a module chip, source
// label, and ripple chips routing to each affected module. Severity bar maps to
// brand tokens only — critical→ink, warn→lime, ok→success green.
const barClass: Record<Severity, string> = {
  critical: "bg-ink-strong",
  warn: "bg-accent",
  ok: "bg-success",
};
const sevLabel: Record<Severity, string> = {
  critical: "Critical",
  warn: "Warning",
  ok: "OK",
};

export function ExceptionRow({ ex }: { ex: Exception }) {
  return (
    <li className="flex items-stretch gap-3 rounded-[11px] border border-line bg-paper p-[13px] transition-colors hover:bg-panel-2">
      <span
        role="img"
        aria-label={sevLabel[ex.severity]}
        className={`w-[3px] flex-none rounded-[2px] ${barClass[ex.severity]}`}
      />
      <div className="min-w-0 flex-1">
        <Link
          href={ex.url}
          className="block rounded-[3px] text-[13.5px] font-semibold leading-[1.3] text-ink hover:text-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {ex.title}
        </Link>
        <div className="mt-[7px] flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <Link
            href={ex.url}
            className="rounded-[5px] bg-panel px-[6px] py-[2px] font-mono text-[9px] uppercase tracking-[0.04em] text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {ex.module}
          </Link>
          <span className="font-mono text-[9.5px] text-ink-muted">
            {ex.sourceLabel}
          </span>
          {ex.ripples.length > 0 && (
            <ArrowRight
              className="h-3 w-3 flex-none text-ink-muted"
              strokeWidth={2}
              aria-hidden
            />
          )}
          {ex.ripples.map((r) => (
            <Link
              key={r}
              href={`/${r}`}
              className="rounded-pill border border-line-strong bg-paper px-[8px] py-[1px] font-mono text-[9.5px] text-ink-muted transition-colors hover:border-ink-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {r}
            </Link>
          ))}
        </div>
      </div>
    </li>
  );
}
