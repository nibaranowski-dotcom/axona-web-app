"use client";

import type { ReactNode } from "react";
import {
  FileText,
  Folder,
  LayoutGrid,
  MessageSquare,
  Workflow,
} from "lucide-react";
import type { SearchHit } from "@axona/db";
import { AgentGlyph } from "@/components/agents/AgentGlyph";

// Grouped result list for the dark full-screen Search (Search.dc.html, role=
// listbox). Rows carry a flat `index` so ↑↓ highlight (managed by CommandPalette)
// maps to the visible order; ↵/click → onSelect. Dark rows: a per-type icon tile,
// title (+ optional tag chip), subtitle, and a right-aligned mono meta.

export interface AnnotatedGroup {
  type: string;
  rows: { hit: SearchHit; index: number }[];
}

const GROUP_LABEL: Record<string, string> = {
  AGENT: "Agents",
  CHAT: "Chats",
  FILE: "Files",
  MODULE: "Modules",
  WORKFLOW: "Workflows",
  PROJECT: "Projects",
};
const TAG: Record<string, string | null> = {
  AGENT: "Agent",
  MODULE: "Module",
  CHAT: null,
  FILE: null,
  WORKFLOW: null,
  PROJECT: null,
};
// icon stroke color per type (lime = signal on live surfaces; white/muted else)
const ICON_COLOR: Record<string, string> = {
  AGENT: "text-on-dark",
  CHAT: "text-accent",
  FILE: "text-on-dark-mut",
  MODULE: "text-on-dark",
  WORKFLOW: "text-accent",
  PROJECT: "text-on-dark-mut",
};

function iconFor(type: string): ReactNode {
  if (type === "AGENT")
    return <AgentGlyph decorative size={18} className="[&>svg]:fill-on-dark" />;
  const cls = "h-[18px] w-[18px]";
  const sw = 1.7;
  switch (type) {
    case "CHAT":
      return <MessageSquare className={cls} strokeWidth={sw} aria-hidden />;
    case "FILE":
      return <FileText className={cls} strokeWidth={sw} aria-hidden />;
    case "MODULE":
      return <LayoutGrid className={cls} strokeWidth={sw} aria-hidden />;
    case "WORKFLOW":
      return <Workflow className={cls} strokeWidth={sw} aria-hidden />;
    default:
      return <Folder className={cls} strokeWidth={sw} aria-hidden />;
  }
}

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
      className="scol mt-[18px] min-h-0 flex-1 overflow-y-auto pr-1"
    >
      {groups.map((g) => (
        <li key={g.type} role="presentation" className="mb-5">
          <div className="mx-1 mb-2 font-mono text-[9.5px] uppercase tracking-[0.07em] text-on-dark-mut">
            {GROUP_LABEL[g.type] ?? g.type}
          </div>
          <ul role="presentation" className="flex flex-col gap-0.5">
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
                    "flex cursor-pointer items-center gap-[13px] rounded-[11px] border px-[13px] py-[11px] transition-colors",
                    active
                      ? "border-[var(--md-active-line)] bg-[var(--md-glass)]"
                      : "border-transparent hover:bg-[var(--md-tile-hover)]",
                  ].join(" ")}
                >
                  <span
                    aria-hidden
                    className={`flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] border border-[var(--md-line)] bg-[var(--md-tile-hover)] ${ICON_COLOR[g.type] ?? "text-on-dark"}`}
                  >
                    {iconFor(g.type)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-semibold text-on-dark">
                        {hit.title}
                      </span>
                      {TAG[g.type] && (
                        <span className="flex-none rounded-[5px] border border-[var(--md-glass-line)] px-[6px] py-px font-mono text-[9px] uppercase tracking-[0.03em] text-on-dark-mut">
                          {TAG[g.type]}
                        </span>
                      )}
                    </span>
                    {hit.subtitle && (
                      <span className="mt-0.5 block truncate text-[12px] text-on-dark-mut">
                        {hit.subtitle}
                      </span>
                    )}
                  </span>
                  <span className="flex-none font-mono text-[10px] uppercase text-on-dark-mut">
                    {g.type}
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
