import type { ReorderCandidate } from "@/lib/procurement";

// The sourcing agent's reorder recommendation (accent-bordered) — parts at/below
// reorder point (PROC.1) + a "Draft PO" affordance that routes to the agent.
// Hidden when there are no candidates.
export function ReorderBanner({
  candidates,
  onDraft,
}: {
  candidates: ReorderCandidate[];
  onDraft: () => void;
}) {
  if (candidates.length === 0) return null;
  const list = candidates
    .map((c) => `${c.sku} ${c.onHand}/${c.reorderPoint}`)
    .join(" · ");
  return (
    <div className="flex flex-wrap items-center justify-between gap-[14px] rounded-[13px] border border-accent bg-paper px-[18px] py-4">
      <div className="flex min-w-0 items-start gap-[13px]">
        <span
          aria-hidden
          className="mt-[6px] h-2 w-2 flex-none rounded-pill bg-accent"
        />
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-ink">
            Sourcing agent recommends a reorder
          </div>
          <div className="mt-1 max-w-[64ch] text-[13px] leading-[1.45] text-ink-muted">
            {candidates.length} part{candidates.length === 1 ? "" : "s"} at or
            below reorder point —{" "}
            <span className="font-mono text-[12px]">{list}</span>.
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onDraft}
        className="flex-none rounded-btn bg-accent px-[15px] py-2 text-[13px] font-semibold text-accent-ink transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-strong"
      >
        Draft PO
      </button>
    </div>
  );
}
