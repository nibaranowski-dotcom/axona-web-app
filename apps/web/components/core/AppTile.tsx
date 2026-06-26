import Link from "next/link";

// DS.1 Mission Control launchpad tile (dark surface, from Mission Control.dc.html).
// Translucent card on the dark launchpad: lettermark glyph square + name +
// optional count badge (lime accent for normal counts; no invented warning hues) + desc.

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
      className="group flex items-center gap-[13px] rounded-[13px] border border-[var(--md-line)] bg-[var(--md-tile)] p-4 transition-colors duration-200 ease-ease hover:border-[var(--md-line-hover)] hover:bg-[var(--md-tile-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span
        aria-hidden
        className="flex h-11 w-11 flex-none items-center justify-center rounded-[11px] border border-[var(--md-line)] bg-[var(--md-tile)] font-mono text-xs text-on-dark-mut"
      >
        {glyph}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold tracking-[-0.01em] text-on-dark">
            {name}
          </span>
          {alert > 0 && (
            <span
              className="flex-none rounded-pill bg-accent px-[6px] py-px font-mono text-[10px] font-bold text-accent-ink"
              aria-label={`${alert} ${alert === 1 ? "alert" : "alerts"}`}
            >
              {alert > 99 ? "99+" : alert}
            </span>
          )}
        </span>
        <span className="mt-[3px] block truncate text-xs leading-tight text-on-dark-mut">
          {description}
        </span>
      </span>
    </Link>
  );
}
