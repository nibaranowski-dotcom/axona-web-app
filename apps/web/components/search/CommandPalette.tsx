"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SearchHit } from "@axona/db";
import { useCommandPalette } from "@/lib/command-palette";
import { useSearch } from "@/lib/use-search";
import { ScopeTabs } from "./ScopeTabs";
import { Results, type AnnotatedGroup } from "./Results";

// Global ⌘K command palette (SRCH.3). Mounted once at the root so it works on the
// / launchpad and inside the shell. DS.1 overlay: scrim + paper panel (hairline,
// no shadow), DS input + ScopeTabs + Results. Focus-trapped; restores focus on
// close. Combobox/listbox a11y semantics.

const TYPE_ORDER = ["MODULE", "AGENT", "WORKFLOW", "PROJECT", "FILE", "CHAT"];

export function CommandPalette() {
  const router = useRouter();
  const { open, query, scope, openPalette, close, toggle, setQuery, setScope } =
    useCommandPalette();
  const state = useSearch(query, scope);
  const [active, setActive] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);

  // Build grouped + flat (highlight order follows the rendered order).
  const { groups, flat } = useMemo(() => {
    let i = 0;
    const g: AnnotatedGroup[] = TYPE_ORDER.map((type) => ({
      type,
      rows: (state.byType[type] ?? []).map((hit) => ({ hit, index: i++ })),
    })).filter((grp) => grp.rows.length > 0);
    const f = g.flatMap((grp) => grp.rows.map((r) => r.hit));
    return { groups: g, flat: f };
  }, [state.byType]);

  useEffect(() => setActive(0), [query, scope, flat.length]);

  const navigate = useCallback(
    (hit: SearchHit) => {
      close();
      router.push(hit.url);
    },
    [close, router],
  );

  // Global open/close keys (always mounted).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing =
        !!el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        toggle();
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        close();
      } else if (e.key === "/" && !typing && !open) {
        e.preventDefault();
        openPalette();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, toggle, close, openPalette]);

  // Focus the field on open; restore prior focus on close.
  useEffect(() => {
    if (open) {
      prevFocus.current = document.activeElement as HTMLElement | null;
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
    prevFocus.current?.focus?.();
    return undefined;
  }, [open]);

  if (!open) return null;

  // Focus trap: keep Tab within the dialog.
  function onDialogKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Tab") return;
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),input,[tabindex]:not([tabindex="-1"])',
    );
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, Math.max(flat.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      const hit = flat[active];
      if (hit) {
        e.preventDefault();
        navigate(hit);
      }
    }
  }

  const trimmed = query.trim();

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onKeyDown={onDialogKeyDown}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className="fixed inset-0 z-50 flex justify-center bg-[var(--scrim)] px-4 pt-[12vh]"
    >
      <div
        role="search"
        aria-label="Sitewide search"
        className="h-fit w-full max-w-[640px] overflow-hidden rounded-card border border-line-strong bg-paper"
      >
        {/* search field (combobox) */}
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <span
            aria-hidden
            className="h-3.5 w-3.5 flex-none rounded-pill border-[1.5px] border-ink-faint"
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            type="text"
            role="combobox"
            aria-expanded
            aria-controls="srch-listbox"
            aria-activedescendant={
              flat.length > 0 ? `srch-opt-${active}` : undefined
            }
            aria-label="Search across everything"
            placeholder="Search agents, modules, projects, files…"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
          />
          <span className="flex-none rounded-[4px] border border-line px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
            ⌘K
          </span>
        </div>

        <ScopeTabs scope={scope} counts={state.counts} onSelect={setScope} />

        {/* states */}
        {!trimmed ? (
          <p className="px-4 py-8 text-center text-sm text-ink-muted">
            Search agents, modules, projects, and files — start typing.
          </p>
        ) : state.loading && flat.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-muted">
            Searching…
          </p>
        ) : state.error ? (
          <p className="px-4 py-8 text-center text-sm text-ink-muted">
            {state.error}.
          </p>
        ) : flat.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-muted">
            No results for “{trimmed}”.
          </p>
        ) : (
          <Results
            groups={groups}
            activeIndex={active}
            onActivate={setActive}
            onSelect={navigate}
          />
        )}
      </div>
    </div>
  );
}
