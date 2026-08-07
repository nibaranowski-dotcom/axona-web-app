"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { SearchHit } from "@axona/db";
import { useCommandPalette } from "@/lib/command-palette";
import { useSearch } from "@/lib/use-search";
import { ScopeTabs } from "./ScopeTabs";
import { Results, type AnnotatedGroup } from "./Results";

// SRCH.4 — the global ⌘K command palette: a centered LIGHT card on a dimmed,
// blurred backdrop, opened OVER the current screen (never a route change), with
// scope tabs + live counts, grouped results, full keyboard nav and deep links.
// `/search` stays the full-page fallback. Mounted once at the root so ⌘K, the
// sidebar field and the launcher all open the same surface.
//
// DESIGN NOTE (flagged, per the CLAUDE.md design-authority rule): the committed
// `Search.dc.html` in this repo is the v8 export — a DARK, FULL-PAGE screen whose
// ESC chip is an <a> to another page. SRCH.4's PRD says that copy has drifted and
// the v10 export is the record ("refresh the committed copy … the two differ by
// ~300 bytes"), and the PRD's own prose describes an overlay that "opens over the
// current screen, not a route change". The v10 export is not reachable from here,
// so the ANATOMY below is implemented 1:1 from the committed file (field + ESC
// chip · scope tabs with counts · grouped rows: icon · title · tag · subtitle ·
// right-aligned mono meta · footer hints + live count · uppercase empty state) and
// only the CHROME follows the PRD/story (light card, dimmed backdrop, modal). The
// committed .dc.html was NOT refreshed — that sync is still outstanding.

// Every indexed type, in display order. This used to list only the six "workspace"
// scopes, so operational hits the index genuinely returns — parts, units, POs, work
// orders, NCRs, ECOs, configs, test runs — were fetched and then silently dropped
// before render: searching a part number found nothing in the palette while /search
// found it. Scope TABS stay the seven the design shows; groups render whatever the
// query actually matched.
const TYPE_ORDER = [
  "AGENT",
  "CHAT",
  "FILE",
  "MODULE",
  "WORKFLOW",
  "PROJECT",
  "UNIT",
  "PART",
  "PURCHASE_ORDER",
  "WORK_ORDER",
  "NCR",
  "ECO",
  "CONFIG_VERSION",
  "TEST_RUN",
];

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

  // Seed from the `#q=` hash on open (a deep link into a pre-filled palette), then
  // clear it so a later ⌘K doesn't silently re-seed the old query.
  useEffect(() => {
    if (!open) return;
    const hash = window.location.hash;
    const m = /^#q=(.*)$/.exec(hash);
    if (!m) return;
    const seeded = decodeURIComponent(m[1] ?? "");
    if (seeded) setQuery(seeded);
    history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
  }, [open, setQuery]);

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
    "inline-flex items-center rounded-[4px] border border-line-strong px-[5px] py-px";

  return (
    // The BACKDROP dims + blurs the screen underneath and is itself the click
    // target that closes — the palette sits over the screen you came from, which is
    // what "returns to the prior screen" means when there was never a navigation.
    <div
      className="fixed inset-0 z-50 flex justify-center overflow-hidden bg-ink/40 px-5 pb-10 pt-[88px] backdrop-blur-[6px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onKeyDown={onDialogKeyDown}
        className="flex max-h-[620px] w-full max-w-[660px] flex-col overflow-hidden rounded-[18px] border border-line bg-paper font-sans text-ink shadow-[0_26px_60px_rgba(0,0,0,0.22)]"
      >
        <div
          role="search"
          aria-label="Sitewide search"
          className="flex min-h-0 w-full flex-1 flex-col"
        >
          {/* search field */}
          <div className="flex flex-none items-center gap-[13px] rounded-[15px] border border-line bg-panel px-[18px] py-[15px] focus-within:border-ink-strong">
            <Search
              className="h-[19px] w-[19px] flex-none text-ink-muted"
              strokeWidth={2}
              aria-hidden
            />
            {/* The listbox only exists when there are results — the empty, loading
                and no-match states render a <p> instead. Advertising aria-controls
                unconditionally left the id dangling (axe aria-valid-attr-value,
                critical); aria-expanded must say whether the popup is really there. */}
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              type="text"
              role="combobox"
              aria-expanded={flat.length > 0}
              aria-controls={flat.length > 0 ? "srch-listbox" : undefined}
              aria-activedescendant={
                flat.length > 0 ? `srch-opt-${active}` : undefined
              }
              aria-label="Search across everything"
              placeholder="Search agents, files, chats, modules…"
              className="min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-muted"
            />
            <button
              type="button"
              onClick={close}
              aria-label="Close search (Esc)"
              className="flex-none rounded-[5px] border border-line-strong px-[7px] py-[3px] font-mono text-[10px] text-mono-faint transition-colors hover:border-ink-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              ESC
            </button>
          </div>

          <ScopeTabs scope={scope} counts={state.counts} onSelect={setScope} />

          {/* states */}
          {!trimmed ? (
            <p className="flex-1 px-3 py-12 text-center font-mono text-[12px] tracking-[0.05em] text-mono-faint">
              Search agents, files, chats, modules — start typing.
            </p>
          ) : state.loading && flat.length === 0 ? (
            <p className="flex-1 px-3 py-12 text-center font-mono text-[12px] tracking-[0.05em] text-mono-faint">
              Searching…
            </p>
          ) : state.error ? (
            <p className="flex-1 px-3 py-12 text-center font-mono text-[12px] tracking-[0.05em] text-mono-faint">
              {state.error}.
            </p>
          ) : flat.length === 0 ? (
            <p className="flex-1 px-3 py-12 text-center font-mono text-[12px] uppercase tracking-[0.05em] text-mono-faint">
              NO MATCHES FOR “{trimmed}”
            </p>
          ) : (
            <>
              {state.degraded && (
                <p
                  role="status"
                  className="mx-3 mt-3 flex-none rounded-[8px] border border-line bg-panel px-3 py-2 font-mono text-[10.5px] tracking-[0.03em] text-ink-muted"
                >
                  Showing available results — full-text search is temporarily
                  degraded.
                </p>
              )}
              <Results
                groups={groups}
                activeIndex={active}
                onActivate={setActive}
                onSelect={navigate}
              />
            </>
          )}

          {/* footer hints */}
          <div className="flex flex-none items-center gap-[18px] border-t border-line px-[18px] py-[12px] font-mono text-[10px] text-mono-faint">
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
    </div>
  );
}
