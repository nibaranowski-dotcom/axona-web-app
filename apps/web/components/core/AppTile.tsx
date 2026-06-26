import Link from "next/link";

// A launcher tile: glyph + name + one-line description, with an ink alert chip
// (count) top-right when there are live exceptions. Critical states use ink —
// no invented warning hues (per design.md).

export function AppTile({
  href,
  name,
  description,
  glyph,
  alert = 0,
}: {
  href: string;
  name: string;
  description: string;
  glyph: string;
  alert?: number;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col gap-2 rounded-card border border-line bg-paper p-4 hover:border-line-strong hover:bg-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {alert > 0 && (
        <span
          className="absolute right-3 top-3 inline-flex min-w-[20px] items-center justify-center rounded-pill bg-ink-strong px-1.5 py-0.5 font-mono text-[10px] leading-none text-paper"
          aria-label={`${alert} ${alert === 1 ? "alert" : "alerts"}`}
        >
          {alert > 99 ? "99+" : alert}
        </span>
      )}
      <span
        aria-hidden
        className="flex h-9 w-9 items-center justify-center rounded-btn bg-panel-2 font-mono text-xs text-ink-muted"
      >
        {glyph}
      </span>
      <span className="text-sm font-medium text-ink-strong">{name}</span>
      <span className="text-xs text-ink-muted">{description}</span>
    </Link>
  );
}
