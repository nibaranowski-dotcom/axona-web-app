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

// SRCH.4 — grouped result list on the light palette card (role=listbox). Rows carry
// a flat `index` so ↑↓ (managed by CommandPalette) maps to the visible order; ↵ and
// click both route to the hit's real href. Row anatomy is the design's: per-type icon
// tile · title (+ optional tag chip) · subtitle · right-aligned mono meta.
//
// The rows are <li role="option">, not the design's <a>. A listbox driven by
// aria-activedescendant must not contain separately focusable anchors — it would give
// screen readers two competing cursors. The href is still what opens (navigate →
// router.push(hit.url)), so the deep-link behaviour is identical.

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
  // Operational entities the index covers — previously fetched and dropped.
  UNIT: "Units",
  PART: "Parts & lots",
  PURCHASE_ORDER: "Purchase orders",
  WORK_ORDER: "Work orders",
  NCR: "Quality (NCRs)",
  ECO: "Change orders",
  CONFIG_VERSION: "Configurations",
  TEST_RUN: "Test runs",
};
const TAG: Record<string, string | null> = {
  AGENT: "Agent",
  MODULE: "Module",
  CHAT: null,
  FILE: null,
  WORKFLOW: null,
  PROJECT: null,
  UNIT: "Unit",
  PART: "Part",
  PURCHASE_ORDER: "PO",
  WORK_ORDER: null,
  NCR: "NCR",
  ECO: "ECO",
  CONFIG_VERSION: "Config",
  TEST_RUN: "Test",
};
// icon stroke color per type (lime = signal on live surfaces; white/muted else)
// Ink on the light card; no invented colour coding — the icon says WHAT a row is,
// the tag and meta say the rest.
const ICON_COLOR: Record<string, string> = {
  AGENT: "text-ink",
  CHAT: "text-ink-muted",
  FILE: "text-ink-muted",
  MODULE: "text-ink",
  WORKFLOW: "text-ink",
  PROJECT: "text-ink-muted",
};

function iconFor(type: string): ReactNode {
  if (type === "AGENT")
    return <AgentGlyph decorative size={18} className="[&>svg]:fill-ink" />;
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
      className="scol min-h-0 flex-1 overflow-y-auto px-3 pb-1 pt-3"
    >
      {groups.map((g) => (
        <li key={g.type} role="presentation" className="mb-4">
          <div className="mx-2 mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.07em] text-mono-faint">
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
                    "flex cursor-pointer items-center gap-[13px] rounded-[11px] border px-[12px] py-[10px] transition-colors",
                    active
                      ? "border-line-strong bg-panel-2"
                      : "border-transparent hover:bg-panel",
                  ].join(" ")}
                >
                  <span
                    aria-hidden
                    className={`flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] border border-line bg-panel ${ICON_COLOR[g.type] ?? "text-ink"}`}
                  >
                    {iconFor(g.type)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 truncate text-[14px] font-semibold text-ink">
                        {hit.title}
                      </span>
                      {TAG[g.type] && (
                        <span className="flex-none rounded-[5px] border border-line-panel px-[6px] py-px font-mono text-[9px] uppercase tracking-[0.03em] text-ink-muted">
                          {TAG[g.type]}
                        </span>
                      )}
                    </span>
                    {hit.subtitle && (
                      <span className="mt-0.5 block truncate text-[12px] text-ink-muted">
                        {hit.subtitle}
                      </span>
                    )}
                  </span>
                  <span className="flex-none font-mono text-[10px] uppercase text-mono-faint">
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
