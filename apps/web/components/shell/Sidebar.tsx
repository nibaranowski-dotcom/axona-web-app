"use client";

import type { NavGroup } from "@/lib/nav";
import { useCommandPalette } from "@/lib/command-palette";
import { NavSection } from "./NavSection";

// Left sidebar: wordmark, the ⌘K search entry, and the four grouped nav sections.
// Hairline right border (no shadow). The ⌘K entry opens the global command
// palette (SRCH.3); the ⌘K/"/" key handling itself lives in CommandPalette.

export function Sidebar({ groups }: { groups: NavGroup[] }) {
  const openPalette = useCommandPalette((s) => s.openPalette);

  return (
    <nav
      aria-label="Primary"
      className="flex h-dvh w-60 flex-col border-r border-line bg-panel"
    >
      {/* Wordmark */}
      <div className="flex items-center gap-2 px-4 py-4">
        <span
          aria-hidden
          className="inline-block h-2.5 w-2.5 rounded-[3px] bg-accent"
        />
        <span className="text-base font-semibold tracking-tight text-ink-strong">
          Axona
        </span>
      </div>

      {/* ⌘K search entry (palette = SRCH.3) */}
      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={() => openPalette()}
          className="flex w-full items-center justify-between rounded-btn border border-line-strong bg-paper px-3 py-1.5 text-sm text-ink-muted hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span>Search</span>
          <span className="rounded-[4px] border border-line px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
            ⌘K
          </span>
        </button>
      </div>

      {/* Grouped nav (empty state if the seed hasn't run) */}
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {groups.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink-muted">
            No modules — run the seed (
            <span className="font-mono">pnpm db:seed</span>).
          </p>
        ) : (
          groups.map((g) => <NavSection key={g.group} group={g} />)
        )}
      </div>

      {/* Stubbed identity until AUTH.1 */}
      <div className="border-t border-line px-4 py-3 text-xs text-ink-muted">
        {/* TODO AUTH.1: real session/user + org switcher */}
        Demo workspace · ADMIN
      </div>
    </nav>
  );
}
