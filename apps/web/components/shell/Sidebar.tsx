"use client";

import { Search } from "lucide-react";
import type { NavGroup } from "@/lib/nav";
import { useCommandPalette } from "@/lib/command-palette";
import { NavSection } from "./NavSection";

// Left sidebar (Axona v2 shell) — 232px, paper surface, hairline right border.
// axona wordmark + the asymmetric square mark, a ⌘K search that opens the
// command palette (SRCH.3), collapsible <details> nav sections, and the identity
// footer. Icons are Lucide (thin stroke); no emoji.

export function Sidebar({ groups }: { groups: NavGroup[] }) {
  const openPalette = useCommandPalette((s) => s.openPalette);

  return (
    <nav
      aria-label="Primary"
      className="flex h-dvh w-[232px] flex-none flex-col border-r border-line bg-paper px-[14px] py-[18px]"
    >
      {/* Wordmark + asymmetric square mark */}
      <div className="flex items-center gap-2 px-2 pb-[18px] pt-1">
        <span className="text-[21px] font-bold tracking-[-0.04em] text-ink-strong">
          axona
        </span>
        <span
          aria-hidden
          className="h-3 w-3 flex-none bg-ink-strong"
          style={{ borderRadius: "0 7px 0 7px" }}
        />
      </div>

      {/* ⌘K search entry (palette = SRCH.3) */}
      <button
        type="button"
        onClick={() => openPalette()}
        className="mx-1 mb-[10px] flex items-center gap-[9px] rounded-[9px] border border-line-strong bg-panel px-[11px] py-2 transition-colors hover:border-ink-strong hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Search
          className="h-3.5 w-3.5 flex-none text-ink-muted"
          strokeWidth={2}
          aria-hidden
        />
        <span className="flex-1 text-left text-[13px] text-ink-muted">
          Search
        </span>
        <span className="rounded-[4px] border border-line-strong px-[5px] py-px font-mono text-[9.5px] text-ink-muted">
          ⌘K
        </span>
      </button>

      {/* Grouped nav (empty state if the seed hasn't run) */}
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        {groups.length === 0 ? (
          <p className="px-3 py-6 text-sm text-ink-muted">
            No modules — run the seed (
            <span className="font-mono">pnpm db:seed</span>).
          </p>
        ) : (
          groups.map((g) => <NavSection key={g.group} group={g} />)
        )}
      </div>

      {/* Stubbed identity until AUTH.1 */}
      <div className="mt-2 flex items-center gap-[10px] border-t border-line px-2 pb-0.5 pt-3">
        <span
          aria-hidden
          className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-accent text-[12px] font-bold text-accent-ink"
        >
          AX
        </span>
        <div className="min-w-0 text-[12.5px] leading-[1.3]">
          <div className="font-semibold text-ink">Demo workspace</div>
          <div className="text-ink-muted">Head of Ops</div>
        </div>
      </div>
    </nav>
  );
}
