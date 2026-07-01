import type { Exception } from "@/lib/core-summary";
import { ExceptionRow } from "./ExceptionRow";

// The cross-module exception feed — the platform-thesis element. Ranked
// (critical first, from CMD.1); each row ripples across the affected modules.
export function ExceptionFeed({ exceptions }: { exceptions: Exception[] }) {
  return (
    <section
      aria-label="Cross-module exceptions"
      className="overflow-hidden rounded-card border border-line-strong bg-panel"
    >
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="font-sans text-sm font-semibold text-ink-strong">
          Cross-module exceptions
        </h2>
        <span className="font-mono text-[11px] text-ink-muted">
          {exceptions.length}
        </span>
      </header>
      {exceptions.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-ink-muted">
          All clear — no open exceptions.
        </p>
      ) : (
        <ol>
          {exceptions.map((e) => (
            <ExceptionRow key={e.id} ex={e} />
          ))}
        </ol>
      )}
    </section>
  );
}
