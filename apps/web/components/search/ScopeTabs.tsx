"use client";

import type { SearchScope } from "@axona/db";

// Scope filter tabs for the dark full-screen Search (Search.dc.html). Active tab =
// lime; inactive = dark glass. Counts from the SRCH.2 response (full totals).
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
    <div className="mt-[14px] flex flex-none flex-wrap gap-[7px]">
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
                ? "border-accent bg-accent text-accent-ink"
                : "border-[var(--md-glass-line)] bg-[var(--md-tile)] text-on-dark-mut hover:bg-[var(--md-tile-hover)]",
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
