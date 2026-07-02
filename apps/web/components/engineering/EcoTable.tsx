import { advanceEco } from "@/app/(shell)/engineering/actions";
import type { Eco } from "@/lib/engineering";

// The change-orders table (Engineering.dc.html) — ECO · Change · Type · Affected
// · Stage, plus a role-gated advance action. Stage carried by a dot (neutral ·
// lime in review · green approved) with ink text — AA-safe, brand palette only.
// RELEASE is the human step (agent proposes; a human releases).
const STAGE: Record<string, { dot: string; label: string }> = {
  DRAFT: { dot: "bg-line-strong", label: "Draft" },
  REVIEW: { dot: "bg-accent", label: "Review" },
  APPROVED: { dot: "bg-success", label: "Approved" },
  RELEASED: { dot: "bg-ink-faint", label: "Released" },
};
const ADVANCE: Record<string, string> = {
  DRAFT: "Submit",
  REVIEW: "Approve",
  APPROVED: "Release",
};

const COLS =
  "grid grid-cols-[0.8fr_2.4fr_0.6fr_1.6fr_1fr_auto] items-center gap-3 px-5";

export function EcoTable({
  ecos,
  canAdvance,
}: {
  ecos: Eco[];
  canAdvance: boolean;
}) {
  const inReview = ecos.filter((e) => e.stage === "REVIEW").length;
  return (
    <section
      aria-label="Change orders"
      className="overflow-hidden rounded-card border border-line bg-paper"
    >
      <div className="flex items-center justify-between px-5 pb-3 pt-4">
        <h2 className="text-[15px] font-semibold text-ink">Change orders</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          {ecos.length} open · {inReview} in review
        </span>
      </div>
      <div
        className={`${COLS} border-t border-line py-[10px] font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted`}
      >
        <span>ECO</span>
        <span>Change</span>
        <span>Type</span>
        <span>Affected</span>
        <span>Stage</span>
        <span className="sr-only">Action</span>
      </div>
      {ecos.length === 0 ? (
        <p className="border-t border-line px-5 py-8 text-center text-sm text-ink-muted">
          No change orders.
        </p>
      ) : (
        ecos.map((e) => {
          const stage = STAGE[e.stage] ?? {
            dot: "bg-line-strong",
            label: e.stage,
          };
          const advanceLabel = ADVANCE[e.stage];
          return (
            <div
              key={e.id}
              className={`${COLS} border-t border-line py-[13px] hover:bg-panel-2`}
            >
              <span className="font-mono text-[12px] text-ink">{e.code}</span>
              <span className="truncate text-[13px] text-ink">{e.title}</span>
              <span>
                <span className="rounded-[5px] border border-line-panel bg-panel px-[6px] py-px font-mono text-[9px] uppercase tracking-[0.04em] text-ink-muted">
                  {e.changeType}
                </span>
              </span>
              <span className="truncate font-mono text-[10.5px] text-ink-muted">
                {e.affected}
              </span>
              <span>
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-panel px-[9px] py-[3px] text-[10.5px] font-semibold tracking-[0.03em] text-ink">
                  <span
                    aria-hidden
                    className={`h-[6px] w-[6px] rounded-pill ${stage.dot}`}
                  />
                  {stage.label}
                </span>
              </span>
              <span className="justify-self-end">
                {canAdvance && advanceLabel ? (
                  <form action={advanceEco.bind(null, e.id)}>
                    <button
                      type="submit"
                      className="rounded-btn border border-line-strong bg-paper px-3 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:border-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {advanceLabel}
                    </button>
                  </form>
                ) : null}
              </span>
            </div>
          );
        })
      )}
    </section>
  );
}
