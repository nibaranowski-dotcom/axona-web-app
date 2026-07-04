import type { ReactNode } from "react";

export interface Stat {
  /** The stat value (a mono number/ratio) — never changed by this primitive. */
  v: ReactNode;
  /** UPPERCASE mono label under the value. */
  l: string;
}

// Shared module-screen stat strip (UX.1) — the single stat-strip primitive so the
// layout can't drift. Two variants, both matching the v2 per-screen designs 1:1:
//   - "card"   (default): a row of stat cells in a rounded hairline card (22px
//     bold value + 9px mono label) — the ~12 module Views.
//   - "inline": a compact top bar (16px value + 9.5px inline mono label) with a
//     bottom hairline — the register-style screens (Workflows, Machines, Projects).
//
// `shrink-0` is load-bearing on both: the card variant uses `overflow-hidden` for
// its rounded corners, which zeroes its flex `min-height` — without `shrink-0`
// the parent flex-col scroll region collapses it and clips the numbers (UX.1).
export function StatStrip({
  stats,
  variant = "card",
}: {
  stats: Stat[];
  variant?: "card" | "inline";
}) {
  if (variant === "inline") {
    return (
      <div className="flex shrink-0 flex-wrap items-center gap-x-[18px] gap-y-2 border-b border-line bg-paper px-6 py-[13px]">
        {stats.map((s) => (
          <div key={s.l}>
            <span className="text-[16px] font-bold text-ink">{s.v}</span>
            <span className="ml-1 font-mono text-[9.5px] uppercase tracking-[0.04em] text-ink-muted">
              {s.l}
            </span>
          </div>
        ))}
      </div>
    );
  }

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
