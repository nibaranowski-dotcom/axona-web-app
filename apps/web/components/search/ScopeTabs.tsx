"use client";

import type { SearchScope } from "@axona/db";
import { Pill } from "@/components/ui";

// Scope filter tabs (DS.1 Pill). Counts come from the SRCH.2 response `counts`
// (full totals, independent of the active scope). Active tab = lime signal.

const TABS: { scope: SearchScope; label: string }[] = [
  { scope: "ALL", label: "All" },
  { scope: "MODULE", label: "Modules" },
  { scope: "AGENT", label: "Agents" },
  { scope: "WORKFLOW", label: "Workflows" },
  { scope: "PROJECT", label: "Projects" },
  { scope: "FILE", label: "Files" },
  { scope: "CHAT", label: "Chats" },
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
    <div className="flex flex-wrap gap-2 border-b border-line px-4 py-3">
      {TABS.map((t) => {
        const count = counts[t.scope] ?? 0;
        const disabled = t.scope !== "ALL" && count === 0;
        return (
          <Pill
            key={t.scope}
            active={scope === t.scope}
            disabled={disabled}
            onClick={() => onSelect(t.scope)}
            className={disabled ? "opacity-40" : ""}
          >
            {t.label}
            <span className="ml-2 font-mono text-[11px] opacity-80">
              {count}
            </span>
          </Pill>
        );
      })}
    </div>
  );
}
