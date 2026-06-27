"use client";

import type { SearchHit } from "@axona/db";

// Grouped result list (role=listbox). Rows carry a flat `index` so ↑↓ highlight
// (managed by CommandPalette) maps to the visible order; ↵/click → onSelect.
// Type "icon" is a DS mono lettermark square (no emoji).

export interface AnnotatedGroup {
  type: string;
  rows: { hit: SearchHit; index: number }[];
}

const TYPE_GLYPH: Record<string, string> = {
  MODULE: "Md",
  AGENT: "Ag",
  WORKFLOW: "Wf",
  PROJECT: "Pr",
  FILE: "Fi",
  CHAT: "Ch",
};

export function Results({
  groups,
  activeIndex,
  onActivate,
  onSelect,
}: {
  groups: AnnotatedGroup[];
  activeIndex: number;
  onActivate: (index: number) => void;
  onSelect: (hit: SearchHit) => void;
}) {
  return (
    <ul
      id="srch-listbox"
      role="listbox"
      aria-label="Search results"
      className="max-h-[52vh] overflow-y-auto p-2"
    >
      {groups.map((g) => (
        <li key={g.type} role="presentation">
          <div className="px-2 pb-1 pt-3 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
            {g.type}
          </div>
          <ul role="presentation">
            {g.rows.map(({ hit, index }) => {
              const active = index === activeIndex;
              return (
                <li
                  key={hit.refId}
                  id={`srch-opt-${index}`}
                  role="option"
                  aria-selected={active}
                  onMouseMove={() => onActivate(index)}
                  onClick={() => onSelect(hit)}
                  className={[
                    "flex cursor-pointer items-center gap-3 rounded-btn border-l-2 px-2 py-2",
                    active
                      ? "border-accent bg-panel-2"
                      : "border-transparent hover:bg-panel-2",
                  ].join(" ")}
                >
                  <span
                    aria-hidden
                    className="flex h-7 w-7 flex-none items-center justify-center rounded-sm border border-line-panel bg-panel font-mono text-[10px] text-ink-muted"
                  >
                    {TYPE_GLYPH[g.type] ?? g.type.slice(0, 2)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink-strong">
                      {hit.title}
                    </span>
                    {hit.subtitle && (
                      <span className="block truncate text-xs text-ink-muted">
                        {hit.subtitle}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}
