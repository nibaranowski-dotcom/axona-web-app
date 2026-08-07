"use client";

import type { SearchScope } from "@axona/db";

// SRCH.4 — scope filter tabs on the light palette card. The SELECTED tab is
// ink-filled (the design's filled state); the rest are hairline-on-panel. Counts are
// LIVE per-scope totals for the current query, computed server-side by countByType
// in the same /api/search round trip — never a client filter over the fetched page,
// so a tab can advertise more results than the current page holds.
const TABS: { scope: SearchScope; label: string }[] = [
  { scope: "ALL", label: "All" },
  { scope: "AGENT", label: "Agents" },
  { scope: "FILE", label: "Files" },
  { scope: "CHAT", label: "Chats" },
  { scope: "MODULE", label: "Modules" },
  { scope: "WORKFLOW", label: "Workflows" },
  { scope: "PROJECT", label: "Projects" },
];

export function ScopeTabs({
  scope,
  counts,
  onSelect,
}: {
  scope: SearchScope;
  counts: Record<string, number>;
  onSelect: (s: SearchScope) => void;
}) {
  return (
    <div className="flex flex-none flex-wrap gap-[7px] border-b border-line px-[18px] py-[12px]">
      {TABS.map((t) => {
        const count = counts[t.scope] ?? 0;
        const active = scope === t.scope;
        return (
          <button
            key={t.scope}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(t.scope)}
            className={[
              "inline-flex items-center gap-[7px] rounded-full border px-[11px] py-[5px] text-[12px] font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              active
                ? "border-ink-strong bg-ink-strong text-on-dark"
                : "border-line bg-panel text-ink-muted hover:border-ink-strong hover:text-ink",
            ].join(" ")}
          >
            {t.label}
            {count > 0 && (
              <span className="font-mono text-[9.5px] opacity-70">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
