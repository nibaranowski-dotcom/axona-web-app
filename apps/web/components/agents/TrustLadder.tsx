import type { TrustCell, TrustRung } from "@axona/db";
import { MonoChip } from "@/components/ui";

// TRUST.1 — the trust panel: where each agent sits on the earned-autonomy ladder, per
// action-kind, with the metrics behind it and what advances it. Read-only, computed on
// read from AUDIT.1. No invented reds — a capped/blocked rung uses ink, not red. No emoji.

const RUNG_LABEL: Record<TrustRung, string> = {
  SUGGEST: "Suggest",
  RECOMMEND: "Recommend",
  REVIEW_LIGHT: "Review-light",
  AUTO_BOUNDED: "Auto-bounded",
};

// Earned live rungs read green (the functional live/approved hue); SUGGEST + the
// defined-but-off AUTO rung read ink (no red anywhere).
function rungChipClass(cell: TrustCell): string {
  if (cell.rung === "RECOMMEND" || cell.rung === "REVIEW_LIGHT")
    return "bg-success-tint text-success";
  return "bg-panel text-ink"; // SUGGEST / AUTO_BOUNDED — ink, never red
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

function calibrationValue(cell: TrustCell): string {
  const m = cell.metrics;
  if (m.overconfident) return "over-confident";
  if (m.calibrationState === "not-measured") return "not flagged";
  return "honest";
}

function TrustRow({ cell }: { cell: TrustCell }) {
  const m = cell.metrics;
  return (
    <li className="rounded-[7px] border border-line-panel bg-paper px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="font-sans text-[13.5px] font-medium text-ink-strong">
            {cell.agentLabel}
          </span>
          <span className="ml-2 font-mono text-[11px] text-ink-muted">
            {cell.actionKind}
          </span>
          {cell.gated && (
            <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
              gated
            </span>
          )}
        </div>
        <span
          className={`shrink-0 rounded-pill px-[9px] py-[3px] font-sans text-[10.5px] font-semibold tracking-[0.04em] ${rungChipClass(cell)}`}
        >
          {RUNG_LABEL[cell.rung]}
          {cell.rung === "AUTO_BOUNDED" && " · off"}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
        <MonoChip label="decided" value={m.volume} />
        <MonoChip label="approval" value={pct(m.approvalRate)} />
        <MonoChip label="override" value={pct(m.overrideRate)} />
        <MonoChip label="calibration" value={calibrationValue(cell)} />
      </div>

      <p className="mt-2.5 font-sans text-[12px] leading-snug text-ink-muted">
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          {cell.cappedBy === "ceiling" ? "Capped" : "To advance"}
        </span>{" "}
        {cell.nextRungCriteria.join(" ")}
      </p>
    </li>
  );
}

export function TrustLadder({ cells }: { cells: TrustCell[] }) {
  return (
    <section aria-label="Earned trust ladder" className="mb-7">
      <div className="mb-2.5 flex items-center gap-3">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.07em] text-ink-muted">
          Earned trust
        </span>
        <span className="h-px flex-1 bg-line" />
        <span className="font-mono text-[10px] text-ink-muted">
          {cells.length}
        </span>
      </div>
      <p className="mb-3 max-w-[52ch] font-sans text-[12px] leading-snug text-ink-muted">
        Autonomy is earned, measured, and visible — computed from each
        agent&apos;s audited track record. Suggest and Recommend are live;
        money, safety, and contract actions stay human-approved (hard ceiling),
        and Auto-bounded is defined but off.
      </p>
      {cells.length === 0 ? (
        <p className="rounded-[7px] border border-line-panel bg-paper px-3.5 py-4 font-sans text-[12.5px] text-ink-muted">
          No decided proposals yet — every agent starts at Suggest (cold-start).
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {cells.map((c) => (
            <TrustRow key={`${c.agentLabel} ${c.actionKind}`} cell={c} />
          ))}
        </ul>
      )}
    </section>
  );
}
