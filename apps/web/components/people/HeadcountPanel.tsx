import type { PeopleRequisition } from "@/lib/people";

// Headcount by function (People.dc.html right column). Absolute filled headcount
// per role, bar-scaled to the largest. Brand palette only.
//
// Note: the model carries requisitions (role · filled · target), not a first-
// class org-structure/function tree — this panel derives headcount from the
// requisition roles (see PPL.2 notes).
export function HeadcountPanel({
  requisitions,
  total,
}: {
  requisitions: PeopleRequisition[];
  total: number;
}) {
  const max = Math.max(1, ...requisitions.map((r) => r.filled));
  return (
    <div className="rounded-card border border-line bg-paper p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">Headcount</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          {total} · by function
        </span>
      </div>
      {requisitions.map((r) => (
        <div
          key={r.id}
          className="flex items-center justify-between gap-2.5 border-t border-line py-[10px]"
        >
          <span className="min-w-0 truncate text-[13px] text-ink">
            {r.role}
          </span>
          <div className="flex flex-none items-center gap-2.5">
            <span className="h-1.5 w-16 overflow-hidden rounded-pill bg-skeleton">
              <span
                className="block h-1.5 rounded-pill bg-line-strong"
                style={{ width: `${(r.filled / max) * 100}%` }}
              />
            </span>
            <span className="w-6 text-right font-mono text-[12px] font-semibold text-ink">
              {r.filled}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
