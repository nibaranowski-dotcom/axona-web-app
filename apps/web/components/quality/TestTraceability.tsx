import Link from "next/link";
import type { TestTraceRow } from "@/lib/quality";

// PLM.V2 — the test-traceability section (`Quality.dc.html` v8). Per-unit test
// runs, each frozen to the config it ran on — kept DISTINCT from the SPC process
// monitoring above (they are different things: process control vs per-unit
// verification). Rows link to the Test Run (PLM.7); "Test explorer →" → PLM.6.
const COLS =
  "grid grid-cols-[1fr_1fr_1.2fr_1.3fr_0.8fr] items-center gap-3 px-5";

export function TestTraceability({ rows }: { rows: TestTraceRow[] }) {
  return (
    <section className="overflow-hidden rounded-card border border-line bg-paper">
      <div className="flex items-center justify-between px-5 pb-2 pt-4">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[15px] font-semibold text-ink">
            Test traceability
          </h2>
          <span className="rounded-[5px] border border-line-panel bg-panel px-[7px] py-0.5 font-mono text-[9.5px] uppercase tracking-[0.04em] text-ink-muted">
            per-unit verification
          </span>
        </div>
        <Link
          href="/tests"
          className="text-[12.5px] font-semibold text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Test explorer →
        </Link>
      </div>
      <p className="px-5 pb-3 text-[12px] text-ink-muted">
        Per-unit test runs, each frozen to the configuration it ran on —
        separate from SPC process monitoring above.
      </p>
      <div
        className={`${COLS} border-t border-line py-[10px] font-mono text-[9px] uppercase tracking-[0.06em] text-ink-faint`}
      >
        <span>Run</span>
        <span>Unit</span>
        <span>Procedure</span>
        <span>Config at run</span>
        <span>Outcome</span>
      </div>
      {rows.length === 0 ? (
        <p className="border-t border-line px-5 py-6 text-center text-sm text-ink-muted">
          No test runs recorded yet.
        </p>
      ) : (
        rows.map((r) => {
          const failed = r.outcome === "fail";
          return (
            <Link
              key={r.code}
              href={r.href}
              className={`${COLS} border-t border-line py-3 transition-colors hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent`}
            >
              <span className="truncate font-mono text-[12px] font-semibold text-ink">
                {r.code}
              </span>
              <span
                className="truncate font-mono text-[11.5px] text-ink-muted"
                title={r.serial}
              >
                {r.serial}
              </span>
              <span
                className="truncate text-[12.5px] text-ink"
                title={r.procedure}
              >
                {r.procedure}
              </span>
              <span
                className="truncate font-mono text-[11px] text-ink-muted"
                title={r.configVersion ?? "—"}
              >
                {r.configVersion ?? "—"}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-bold ${failed ? "text-ink-strong" : "text-success"}`}
              >
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 rounded-full ${failed ? "bg-ink-strong" : "bg-success"}`}
                />
                {r.outcome.toUpperCase()}
              </span>
            </Link>
          );
        })
      )}
    </section>
  );
}
