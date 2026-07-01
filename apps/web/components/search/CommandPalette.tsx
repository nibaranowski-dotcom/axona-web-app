"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { SearchHit } from "@axona/db";
import { useCommandPalette } from "@/lib/command-palette";
import { useSearch } from "@/lib/use-search";
import { ScopeTabs } from "./ScopeTabs";
import { Results, type AnnotatedGroup } from "./Results";

// The global ⌘K Search (SRCH.3) — a DARK full-screen surface matching
// Search.dc.html (not a white modal). Mounted once at the root so ⌘K / the
// sidebar bar / the Mission Control pill all open the SAME experience over any
// screen. SRCH.2 data wiring is unchanged (useSearch → /api/search); only the
// shell/skin is dark. Focus-trapped; ↑↓ move · ↵ open · Esc close.

const TYPE_ORDER = ["AGENT", "CHAT", "FILE", "MODULE", "WORKFLOW", "PROJECT"];

export function CommandPalette() {
  const router = useRouter();
  const { open, query, scope, openPalette, close, toggle, setQuery, setScope } =
    useCommandPalette();
  const state = useSearch(query, scope);
  const [active, setActive] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);

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

  // Focus trap: keep Tab within the surface.
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
  const hintKey =
    "inline-flex items-center rounded-[4px] border border-[var(--md-line-hover)] px-[5px] py-px";

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onKeyDown={onDialogKeyDown}
      className="bg-mission fixed inset-0 z-50 flex flex-col items-center px-5 pb-10 pt-16 font-sans text-on-dark"
    >
      <div
        role="search"
        aria-label="Sitewide search"
        className="flex min-h-0 w-full max-w-[680px] flex-1 flex-col"
      >
        {/* search field */}
        <div className="flex flex-none items-center gap-[13px] rounded-[15px] border border-[var(--md-glass-line)] bg-[var(--md-glass)] px-[18px] py-[15px] backdrop-blur-[12px] focus-within:border-accent">
          <Search
            className="h-5 w-5 flex-none text-on-dark-mut"
            strokeWidth={2}
            aria-hidden
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
            placeholder="Search agents, files, chats, modules…"
            className="min-w-0 flex-1 bg-transparent text-[17px] text-on-dark outline-none placeholder:text-on-dark-mut"
          />
          <button
            type="button"
            onClick={close}
            aria-label="Close search (Esc)"
            className="flex-none rounded-[5px] border border-[var(--md-line-hover)] px-[7px] py-[3px] font-mono text-[10px] text-on-dark-mut transition-colors hover:text-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            ESC
          </button>
        </div>

        <ScopeTabs scope={scope} counts={state.counts} onSelect={setScope} />

        {/* states */}
        {!trimmed ? (
          <p className="mt-[18px] flex-1 py-12 text-center font-mono text-[12px] tracking-[0.05em] text-on-dark-mut">
            Search agents, files, chats, modules — start typing.
          </p>
        ) : state.loading && flat.length === 0 ? (
          <p className="mt-[18px] flex-1 py-12 text-center font-mono text-[12px] tracking-[0.05em] text-on-dark-mut">
            Searching…
          </p>
        ) : state.error ? (
          <p className="mt-[18px] flex-1 py-12 text-center font-mono text-[12px] tracking-[0.05em] text-on-dark-mut">
            {state.error}.
          </p>
        ) : flat.length === 0 ? (
          <p className="mt-[18px] flex-1 py-12 text-center font-mono text-[12px] uppercase tracking-[0.05em] text-on-dark-mut">
            No matches for “{trimmed}”
          </p>
        ) : (
          <Results
            groups={groups}
            activeIndex={active}
            onActivate={setActive}
            onSelect={navigate}
          />
        )}

        {/* footer hints */}
        <div className="mt-[14px] flex flex-none items-center gap-[18px] border-t border-[var(--md-rule)] pt-[14px] font-mono text-[10px] text-on-dark-mut">
          <span className="inline-flex items-center gap-[6px]">
            <span className={hintKey}>↑↓</span>navigate
          </span>
          <span className="inline-flex items-center gap-[6px]">
            <span className={hintKey}>↵</span>open
          </span>
          <span className="inline-flex items-center gap-[6px]">
            <span className={hintKey}>esc</span>close
          </span>
          <span className="ml-auto">{flat.length} results</span>
        </div>
      </div>
    </div>
  );
}
