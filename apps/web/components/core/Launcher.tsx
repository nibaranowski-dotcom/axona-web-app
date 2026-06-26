"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { NavGroup } from "@/lib/nav";
import { metaFor } from "@/lib/module-meta";
import { AppTile } from "./AppTile";

// Mission Control launcher (build-spec §4.1) — the post-login home, rendered in
// the shell <main>. Four bands of module tiles + a search field that hands the
// query to the Search palette (SRCH.3). The Mission Control entry itself ("/")
// is not rendered as a tile (no self-link).

export function Launcher({
  groups,
  alerts,
}: {
  groups: NavGroup[];
  alerts: Record<string, number>;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
  }

  const visible = groups
    .map((g) => ({
      ...g,
      modules: g.modules.filter((m) => m.key !== "mission-control"),
    }))
    .filter((g) => g.modules.length > 0);

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <header className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-widest text-ink-muted">
          Mission Control
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-strong">
          Operating system for robotics
        </h1>
        <form onSubmit={onSubmit} className="mt-4 max-w-xl" role="search">
          <label htmlFor="mc-search" className="sr-only">
            Search across everything
          </label>
          <div className="flex items-center gap-2 rounded-btn border border-line-strong bg-paper px-3 py-2 focus-within:ring-2 focus-within:ring-accent">
            <input
              id="mc-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search modules, files, agents…"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
            />
            <span className="rounded-[4px] border border-line px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
              ⌘K
            </span>
          </div>
        </form>
      </header>

      {visible.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No modules — run the seed (
          <span className="font-mono">pnpm db:seed</span>).
        </p>
      ) : (
        <div className="space-y-8">
          {visible.map((g) => (
            <section key={g.group} aria-label={g.label}>
              <h2 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ink-muted">
                {g.label}
              </h2>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
                {g.modules.map((m) => {
                  const meta = metaFor(m.key, m.name);
                  return (
                    <AppTile
                      key={m.key}
                      href={m.href}
                      name={m.name}
                      description={meta.description}
                      glyph={meta.glyph}
                      alert={alerts[m.key] ?? 0}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
