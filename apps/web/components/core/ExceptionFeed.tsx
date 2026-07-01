import type { Exception } from "@/lib/core-summary";
import { ExceptionRow } from "./ExceptionRow";

// The cross-module "needs attention" feed (v2 CC) — the platform-thesis element.
// Ranked critical-first (from CMD.1); each row ripples across affected modules.
export function ExceptionFeed({ exceptions }: { exceptions: Exception[] }) {
  return (
    <section aria-label="Cross-module exceptions">
      <div className="mb-3 flex items-center gap-[10px]">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-muted">
          Needs attention
        </span>
        <span className="font-mono text-[10px] text-ink-muted">
          {exceptions.length} open
        </span>
      </div>
      {exceptions.length === 0 ? (
        <p className="rounded-[11px] border border-line bg-paper px-4 py-8 text-center text-sm text-ink-muted">
          All clear — no open exceptions.
        </p>
      ) : (
        <ol className="flex flex-col gap-[10px]">
          {exceptions.map((e) => (
            <ExceptionRow key={e.id} ex={e} />
          ))}
        </ol>
      )}
    </section>
  );
}
