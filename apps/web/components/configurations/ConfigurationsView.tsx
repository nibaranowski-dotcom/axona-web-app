"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Lock, GitCompare, Check } from "lucide-react";
import type { ConfigRow, ConfigDiff } from "@/lib/configurations";
import {
  lockConfigAction,
  compareConfigsAction,
} from "@/app/(shell)/configurations/actions";

// PLM.10 — Configurations (`Configurations.dc.html` 1:1 on DS.1 primitives). The
// named ConfigurationVersions with resolved hw + sw + baseline/lock state + a
// matching-units count (→ /units filtered by that config). Lock/baseline is gated
// via decide("config.lock"). Compare two versions → hw + sw deltas. LIST screen:
// back-arrow + mono eyebrow (not breadcrumbs).

export function ConfigurationsView({
  configs,
  canLock,
}: {
  configs: ConfigRow[];
  canLock: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [diff, setDiff] = useState<ConfigDiff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (name: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else if (next.size < 2) next.add(name);
      return next;
    });

  const compare = () => {
    const [a, b] = [...selected];
    if (!a || !b) return;
    setError(null);
    startTransition(async () => {
      try {
        setDiff(await compareConfigsAction(a, b));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Compare failed.");
      }
    });
  };

  const lock = (id: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await lockConfigAction(id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Lock failed.");
      }
    });
  };

  return (
    <div className="flex min-h-full flex-col bg-panel">
      <header className="sticky top-0 z-20 flex h-[60px] flex-none items-center justify-between border-b border-line bg-paper px-6">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
            Engineering · configuration management
          </div>
          <h1 className="mt-0.5 inline-flex items-center gap-[10px] text-[19px] font-semibold tracking-[-0.02em] text-ink">
            <Link
              href="/engineering"
              title="Back to Engineering"
              aria-label="Back to Engineering"
              className="inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-[7px] border border-line-strong text-ink-muted transition-colors hover:border-ink-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ChevronLeft className="h-[15px] w-[15px]" strokeWidth={1.9} />
            </Link>
            Configuration baselines
          </h1>
        </div>
        <button
          type="button"
          onClick={compare}
          disabled={selected.size !== 2 || pending}
          className="inline-flex items-center gap-2 rounded-btn bg-ink-strong px-[15px] py-[9px] text-[13px] font-semibold text-on-dark transition-colors hover:bg-black disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <GitCompare className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden />
          Compare versions
        </button>
      </header>

      <div className="flex-1 px-6 pb-16 pt-5">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.05em] text-ink-faint">
          Named configurations · {configs.length}
        </div>
        {error && (
          <p role="alert" className="mb-3 text-[12px] text-ink">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3">
          {configs.map((c) => {
            const sel = selected.has(c.name);
            return (
              <div
                key={c.id}
                className="rounded-card border border-line bg-paper px-5 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={sel}
                      aria-label={`Select ${c.name} to compare`}
                      onClick={() => toggle(c.name)}
                      className={`mt-1 inline-flex h-[15px] w-[15px] flex-none items-center justify-center rounded-[4px] border-[1.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                        sel ? "border-accent bg-accent" : "border-line-strong"
                      }`}
                    >
                      {sel && (
                        <Check
                          className="h-2.5 w-2.5 text-accent-ink"
                          strokeWidth={3.5}
                        />
                      )}
                    </button>
                    <div>
                      <div className="flex items-center gap-2.5">
                        {/* PLM.11 — the card name links into the Configuration detail. */}
                        <Link
                          href={`/configurations/${encodeURIComponent(c.name)}`}
                          className="font-mono text-[14px] font-semibold text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          {c.name}
                        </Link>
                        <span className="font-mono text-[10.5px] text-ink-muted">
                          {c.model}
                        </span>
                        {c.locked ? (
                          <span className="inline-flex items-center gap-1 rounded-pill bg-success-tint px-2 py-0.5 text-[10px] font-semibold text-success">
                            <Lock
                              className="h-2.5 w-2.5"
                              strokeWidth={2}
                              aria-hidden
                            />
                            Baseline
                          </span>
                        ) : (
                          <span className="rounded-pill border border-line-panel bg-panel px-2 py-0.5 text-[10px] font-semibold text-ink-muted">
                            Draft
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11.5px] text-ink-muted">
                        <span>
                          <span className="text-ink-faint">HW </span>
                          {Object.entries(c.hw)
                            .map(([k, v]) => `${k} ${v}`)
                            .join(" · ") || "—"}
                        </span>
                        <span>
                          <span className="text-ink-faint">SW </span>
                          {Object.entries(c.sw)
                            .map(([k, v]) => `${k} ${v}`)
                            .join(" · ") || "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-none items-center gap-3">
                    <Link
                      href={c.matchingHref}
                      className="text-[12.5px] text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <span className="font-mono font-semibold">
                        {c.matchingUnits}
                      </span>{" "}
                      units →
                    </Link>
                    {canLock && !c.locked && (
                      <button
                        type="button"
                        onClick={() => lock(c.id)}
                        disabled={pending}
                        className="inline-flex items-center gap-1.5 rounded-btn border border-line-strong bg-paper px-3 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:border-ink-strong disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <Lock
                          className="h-3 w-3"
                          strokeWidth={1.9}
                          aria-hidden
                        />
                        Lock baseline
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {diff && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Compare ${diff.a} and ${diff.b}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-strong/30 p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDiff(null);
          }}
        >
          <div className="max-h-[86vh] w-full max-w-[640px] overflow-y-auto rounded-card border border-line bg-paper p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-ink">
                <span className="font-mono">{diff.a}</span> vs{" "}
                <span className="font-mono">{diff.b}</span>
              </h2>
              <button
                type="button"
                onClick={() => setDiff(null)}
                className="rounded-btn border border-line-strong px-3 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:border-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Close
              </button>
            </div>
            <DiffTable title="Hardware" rows={diff.hw} />
            <DiffTable title="Software" rows={diff.sw} />
          </div>
        </div>
      )}
    </div>
  );
}

function DiffTable({ title, rows }: { title: string; rows: ConfigDiff["hw"] }) {
  return (
    <section className="mt-5">
      <h3 className="mb-2 font-mono text-[9px] uppercase tracking-[0.06em] text-ink-faint">
        {title}
      </h3>
      <div className="overflow-hidden rounded-[10px] border border-line">
        {rows.map((r, i) => (
          <div
            key={r.key}
            className={`grid grid-cols-[1fr_1fr_1fr] items-center gap-2.5 px-3 py-2.5 text-[12px] ${i > 0 ? "border-t border-line" : ""} ${r.differs ? "bg-panel-2" : ""}`}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
              {r.key}
              {r.differs && (
                <span className="ml-1.5 rounded-[4px] bg-accent px-1 py-px text-[8px] font-bold uppercase text-accent-ink">
                  delta
                </span>
              )}
            </span>
            <span
              className={`font-mono text-[11.5px] ${r.differs ? "font-semibold text-ink" : "text-ink-muted"}`}
            >
              {r.a ?? "—"}
            </span>
            <span
              className={`font-mono text-[11.5px] ${r.differs ? "font-semibold text-ink" : "text-ink-muted"}`}
            >
              {r.b ?? "—"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
