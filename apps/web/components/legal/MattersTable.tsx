import type { LegalMatterRow } from "@/lib/legal";
import { matterBadge, titleCase } from "./format";

// Matters & compliance (Legal.dc.html) — type · matter · linked-to (source
// module) · status. Each matter links back to the module that produced it
// (INC-201 → autonomy, ECO-318 → engineering, …). Brand palette only.
const COLS = "grid grid-cols-[0.9fr_2.1fr_1.3fr_1fr] items-center gap-3 px-5";

export function MattersTable({ matters }: { matters: LegalMatterRow[] }) {
  const open = matters.filter((m) => m.open).length;
  return (
    <section
      aria-label="Matters and compliance"
      className="overflow-hidden rounded-card border border-line bg-paper"
    >
      <div className="flex items-center justify-between px-5 pb-3 pt-4">
        <h2 className="text-[15px] font-semibold text-ink">
          Matters &amp; compliance
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          {open} open · linked to ops
        </span>
      </div>
      <div
        className={`${COLS} border-t border-line py-[10px] font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted`}
      >
        <span>Type</span>
        <span>Matter</span>
        <span>Linked to</span>
        <span>Status</span>
      </div>
      {matters.length === 0 ? (
        <p className="border-t border-line px-5 py-8 text-center text-sm text-ink-muted">
          No matters.
        </p>
      ) : (
        matters.map((m) => (
          <div
            key={m.id}
            className={`${COLS} border-t border-line py-[13px] hover:bg-panel-2`}
          >
            <span>
              <span className="inline-flex items-center rounded-[5px] border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[9px] tracking-[0.04em] text-ink">
                {m.type}
              </span>
            </span>
            <span className="truncate text-[13px] text-ink">{m.title}</span>
            <span className="truncate font-mono text-[10.5px] text-ink-muted">
              {m.module ? `${titleCase(m.module)} · ` : ""}
              {m.linkedTo}
            </span>
            <span>
              <span
                className={`inline-flex items-center rounded-pill px-[9px] py-[3px] text-[10.5px] font-semibold tracking-[0.03em] ${matterBadge(m.status)}`}
              >
                {titleCase(m.status)}
              </span>
            </span>
          </div>
        ))
      )}
    </section>
  );
}
