import type { ReactNode } from "react";

export interface Stat {
  /** The stat value (a mono number/ratio) — never changed by this primitive. */
  v: ReactNode;
  /** UPPERCASE mono label under the value. */
  l: string;
}

// Shared module-screen stat strip (UX.1) — one row of stat cells in a rounded
// hairline card, matching the v2 per-screen designs 1:1 (22px bold value + 9px
// mono label). Extracted so the layout can't drift across the ~12 module Views.
//
// `shrink-0` is load-bearing: the card uses `overflow-hidden` for its rounded
// corners, which makes its flex `min-height` compute to 0 — without `shrink-0`
// the parent flex-col scroll region collapses the strip below its content and
// clips the numbers (the UX.1 bug). Numbers + labels always render in full.
export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <div className="flex shrink-0 overflow-hidden rounded-card border border-line bg-paper">
      {stats.map((s, i) => (
        <div
          key={s.l}
          className={`min-w-0 flex-1 px-[18px] py-[15px] ${i ? "border-l border-line" : ""}`}
        >
          <div className="text-[22px] font-bold tracking-[-0.03em] text-ink">
            {s.v}
          </div>
          <div className="mt-[3px] font-mono text-[9px] uppercase tracking-[0.05em] text-ink-muted">
            {s.l}
          </div>
        </div>
      ))}
    </div>
  );
}
