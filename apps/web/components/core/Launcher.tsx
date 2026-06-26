"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { NavGroup } from "@/lib/nav";
import { metaFor } from "@/lib/module-meta";
import { AppTile } from "./AppTile";

// Mission Control launchpad (build-spec §4.1; DS.1 dark launchpad matching
// Mission Control.dc.html). Full-screen dark surface, centered glassy ⌘K search,
// grouped sections (mono label + hairline rule + count), translucent tiles.
// The Mission Control entry itself ("/") is not a tile (no self-link).

export function Launcher({
  groups,
  alerts,
}: {
  groups: NavGroup[];
  alerts: Record<string, number>;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K focuses the launchpad search.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
  }

  // Live in-page filter over the tiles (the prototype filters by name/desc).
  const term = q.trim().toLowerCase();
  const sections = useMemo(
    () =>
      groups
        .map((g) => ({
          label: g.label,
          modules: g.modules
            .filter((m) => m.key !== "mission-control")
            .map((m) => ({ ...m, meta: metaFor(m.key, m.name) }))
            .filter(
              (m) =>
                !term ||
                m.name.toLowerCase().includes(term) ||
                m.meta.description.toLowerCase().includes(term),
            ),
        }))
        .filter((g) => g.modules.length > 0),
    [groups, term],
  );

  const noResults = term.length > 0 && sections.length === 0;

  return (
    <main className="bg-mission min-h-dvh font-sans text-on-dark">
      <h1 className="sr-only">Mission Control</h1>
      {/* top-right: agent actions · clock · avatar (clock/identity are stubs → AUTH.1) */}
      <div className="absolute right-6 top-4 z-[5] flex items-center gap-[13px]">
        <span className="inline-flex items-center gap-[7px] font-mono text-[11px] text-on-dark-mut">
          <span className="h-1.5 w-1.5 rounded-pill bg-accent" />
          514 agent actions
        </span>
        <span className="font-mono text-[11px] text-on-dark-faint">09:41</span>
        <span className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-pill bg-accent text-[10.5px] font-bold text-accent-ink">
          LC
        </span>
      </div>

      <div className="relative mx-auto flex min-h-dvh max-w-[1000px] flex-col px-7 pb-14 pt-16">
        {/* centered glassy search pill */}
        <div className="mb-12 flex justify-center">
          <form
            onSubmit={onSubmit}
            role="search"
            className="flex w-[208px] max-w-[70vw] items-center gap-[9px] rounded-pill border border-[var(--md-glass-line)] bg-[var(--md-glass)] px-[13px] py-[7px] backdrop-blur focus-within:ring-2 focus-within:ring-accent"
          >
            <label htmlFor="mc-search" className="sr-only">
              Search across everything
            </label>
            <span
              aria-hidden
              className="h-3 w-3 flex-none rounded-pill border-[1.5px] border-on-dark-mut"
            />
            <input
              id="mc-search"
              ref={inputRef}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-on-dark outline-none placeholder:text-on-dark-faint"
            />
            <span className="flex-none rounded-[4px] border border-[var(--md-glass-line)] px-[5px] py-px font-mono text-[9.5px] text-on-dark-faint">
              ⌘K
            </span>
          </form>
        </div>

        {noResults ? (
          <div className="py-10 text-center font-mono text-xs uppercase tracking-[0.05em] text-on-dark-faint">
            No apps match “{q.trim()}”
          </div>
        ) : (
          sections.map((g) => (
            <section key={g.label} aria-label={g.label} className="mb-8">
              <div className="mb-4 flex items-center gap-[13px]">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.07em] text-on-dark-mut">
                  {g.label}
                </span>
                <span className="h-px flex-1 bg-[var(--md-rule)]" />
                <span className="font-mono text-[10px] text-on-dark-mut">
                  {g.modules.length} {g.modules.length === 1 ? "app" : "apps"}
                </span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(252px,1fr))] gap-[14px]">
                {g.modules.map((m) => (
                  <AppTile
                    key={m.key}
                    href={m.href}
                    name={m.name}
                    description={m.meta.description}
                    glyph={m.meta.glyph}
                    alert={alerts[m.key] ?? 0}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </main>
  );
}
