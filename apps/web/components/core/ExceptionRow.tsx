import Link from "next/link";
import type { Exception, Severity } from "@/lib/core-summary";

// One cross-module exception: severity dot + title (links to the source object)
// + a source chip + ripple chips routing to each affected module. Severity dot
// maps to brand tokens only — critical→ink, warn→lime, ok→success green.
const sevDot: Record<Severity, string> = {
  critical: "bg-ink-strong",
  warn: "bg-accent",
  ok: "bg-success",
};
const sevLabel: Record<Severity, string> = {
  critical: "Critical",
  warn: "Warning",
  ok: "OK",
};

const chip =
  "rounded-pill border border-line-strong bg-paper px-[9px] py-[2px] font-mono text-[10.5px] text-ink-muted transition-colors hover:border-ink-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

export function ExceptionRow({ ex }: { ex: Exception }) {
  return (
    <li className="flex flex-col gap-2 border-b border-line px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-4">
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <span
          role="img"
          aria-label={sevLabel[ex.severity]}
          className={`h-2.5 w-2.5 flex-none rounded-pill ${sevDot[ex.severity]}`}
        />
        <Link
          href={ex.url}
          className="min-w-0 truncate rounded-[3px] font-sans text-sm text-ink hover:text-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {ex.title}
        </Link>
      </span>
      <span className="flex flex-wrap items-center gap-1.5 pl-[23px] sm:pl-0">
        <Link
          href={ex.url}
          className="rounded-[5px] border border-line-strong bg-paper px-[7px] py-[2px] font-mono text-[10.5px] text-ink-muted transition-colors hover:border-ink-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {ex.sourceLabel}
        </Link>
        {ex.ripples.length > 0 && (
          <span aria-hidden className="font-mono text-[11px] text-ink-muted">
            →
          </span>
        )}
        {ex.ripples.map((r) => (
          <Link key={r} href={`/${r}`} className={chip}>
            {r}
          </Link>
        ))}
      </span>
    </li>
  );
}
