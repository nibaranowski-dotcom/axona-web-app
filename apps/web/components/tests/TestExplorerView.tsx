"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, Search, Check, GitCompare } from "lucide-react";
import type {
  TestExplorerData,
  TestFilters,
  CompareData,
} from "@/lib/tests-types";
import { compareRunsAction } from "@/app/(shell)/tests/actions";

export type { TestExplorerData };

// PLM.6 — the Test Explorer (`Test Explorer.dc.html` 1:1 on DS.1 primitives). Runs
// grouped by procedure; select 2+ → compare across configurations (the whole
// point — "how the builds differed"). Config-at-run is the FROZEN snapshot.
// LIST screen: back-arrow to Quality + mono eyebrow (not breadcrumbs).

const COLS =
  "grid grid-cols-[28px_1fr_1fr_1.1fr_1.4fr_0.8fr] items-center gap-3 px-[18px]";
const FACETS: {
  key: keyof TestFilters;
  label: string;
  opts: (f: TestExplorerData["facets"]) => string[];
}[] = [
  { key: "procedure", label: "Procedure", opts: (f) => f.procedure },
  { key: "config", label: "Config version", opts: (f) => f.config },
  { key: "unit", label: "Unit", opts: (f) => f.unit },
  { key: "outcome", label: "Outcome", opts: (f) => f.outcome },
];

export function TestExplorerView({
  data,
  filters = {},
  error = false,
}: {
  data: TestExplorerData;
  filters?: TestFilters;
  error?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [compare, setCompare] = useState<CompareData | null>(null);
  const [compareErr, setCompareErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const setFilter = (key: string, value: string) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
    if (value) p.set(key, value);
    else p.delete(key);
    startTransition(() => router.push(`${pathname}?${p.toString()}`));
  };

  const toggle = (code: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const runCompare = () => {
    setCompareErr(null);
    startTransition(async () => {
      try {
        setCompare(await compareRunsAction([...selected]));
      } catch (e) {
        setCompareErr(e instanceof Error ? e.message : "Compare failed.");
      }
    });
  };

  const activeFilters = Object.values(filters).filter(Boolean).length;

  return (
    <div className="flex min-h-full flex-col bg-panel">
      <header className="sticky top-0 z-20 flex h-[60px] flex-none items-center justify-between border-b border-line bg-paper px-6">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
            Quality · test traceability
          </div>
          <h1 className="mt-0.5 inline-flex items-center gap-[10px] text-[19px] font-semibold tracking-[-0.02em] text-ink">
            <Link
              href="/quality"
              title="Back to Quality"
              aria-label="Back to Quality"
              className="inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-[7px] border border-line-strong text-ink-muted transition-colors hover:border-ink-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ChevronLeft className="h-[15px] w-[15px]" strokeWidth={1.9} />
            </Link>
            Test explorer
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-[7px] rounded-pill border border-line-strong bg-panel px-3 py-[5px] text-[12.5px] font-semibold text-ink">
            {selected.size} selected
          </span>
          <button
            type="button"
            onClick={runCompare}
            disabled={selected.size < 2 || pending}
            className="inline-flex items-center gap-2 rounded-btn bg-ink-strong px-[15px] py-[9px] text-[13px] font-semibold text-on-dark transition-colors hover:bg-black disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <GitCompare className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden />
            Compare selected
          </button>
        </div>
      </header>

      {/* filter bar */}
      <div className="sticky top-[60px] z-[15] flex flex-none flex-wrap items-center gap-2.5 border-b border-line bg-paper px-6 py-3.5">
        <label className="flex min-w-[220px] flex-1 items-center gap-2.5 rounded-[9px] border border-line-strong bg-panel px-3 focus-within:border-ink-strong focus-within:ring-2 focus-within:ring-accent">
          <Search
            className="h-3.5 w-3.5 flex-none text-ink-faint"
            strokeWidth={2}
            aria-hidden
          />
          <span className="sr-only">Search test id, unit, procedure</span>
          <input
            defaultValue={filters.q ?? ""}
            onKeyDown={(e) => {
              if (e.key === "Enter")
                setFilter("q", (e.target as HTMLInputElement).value);
            }}
            placeholder="Search test id, unit, procedure…"
            className="min-w-0 flex-1 border-none bg-transparent py-2.5 text-[13px] text-ink outline-none placeholder:text-ink-faint"
          />
        </label>
        {FACETS.map((f) => (
          <FacetChip
            key={f.key}
            label={f.label}
            value={(filters[f.key] as string) ?? ""}
            options={f.opts(data.facets)}
            onChange={(v) => setFilter(f.key, v)}
          />
        ))}
        {activeFilters > 0 && (
          <Link
            href={pathname}
            className="rounded-pill border border-line px-2.5 py-[7px] font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted transition-colors hover:border-ink-strong hover:text-ink"
          >
            Clear
          </Link>
        )}
      </div>

      <div className="min-w-0 flex-1 px-6 pb-6">
        <div className="flex items-center gap-2 py-3 pt-4">
          <span className="font-mono text-[19px] font-bold tracking-[-0.02em] text-ink">
            {data.matched}
          </span>
          <span className="text-[12.5px] text-ink-muted">
            run{data.matched === 1 ? "" : "s"}
            {activeFilters ? ` of ${data.total}` : ""} · grouped by procedure ·
            select 2+ to compare across configurations
          </span>
        </div>

        {error ? (
          <p role="status" className="py-14 text-center text-sm text-ink-muted">
            Couldn’t load test runs. Check the database and refresh.
          </p>
        ) : data.groups.length === 0 ? (
          <div className="rounded-card border border-line bg-paper px-6 py-14 text-center">
            <p className="text-[13.5px] font-semibold text-ink">
              No test runs yet.
            </p>
            <p className="mx-auto mt-1.5 max-w-[52ch] text-[12.5px] text-ink-muted">
              Runs appear here as units are tested — each frozen to the config
              it ran on. Adjust the filters above.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-[18px]">
            {data.groups.map((g) => (
              <div
                key={g.procedure}
                className="overflow-hidden rounded-[14px] border border-line bg-paper"
              >
                <div className="flex items-center justify-between border-b border-line px-[18px] py-3.5">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-[14.5px] font-semibold text-ink">
                      {g.procedure}
                    </h2>
                    <span className="rounded-[5px] border border-line-panel bg-panel px-[7px] py-0.5 font-mono text-[9.5px] tracking-[0.03em] text-ink-muted">
                      {g.code}
                    </span>
                  </div>
                  <span className="font-mono text-[10.5px] text-ink-faint">
                    {g.stat}
                  </span>
                </div>
                <div
                  className={`${COLS} border-b border-line py-[9px] font-mono text-[9px] uppercase tracking-[0.06em] text-ink-faint`}
                >
                  <span aria-hidden />
                  <span>Run</span>
                  <span>Unit</span>
                  <span>Config at run</span>
                  <span>Key measurement</span>
                  <span>Outcome</span>
                </div>
                {g.runs.map((r) => {
                  const sel = selected.has(r.code);
                  const failed = r.outcome === "fail";
                  return (
                    <div
                      key={r.code}
                      className={`${COLS} border-t border-line py-3 transition-colors hover:bg-panel-2`}
                    >
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={sel}
                        aria-label={`Select ${r.code} to compare`}
                        onClick={() => toggle(r.code)}
                        className={`inline-flex h-[15px] w-[15px] items-center justify-center rounded-[4px] border-[1.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                          sel
                            ? "border-accent bg-accent"
                            : "border-line-strong bg-transparent"
                        }`}
                      >
                        {sel && (
                          <Check
                            className="h-2.5 w-2.5 text-accent-ink"
                            strokeWidth={3.5}
                          />
                        )}
                      </button>
                      <Link
                        href={`/tests/${encodeURIComponent(r.code)}`}
                        className="min-w-0 truncate font-mono text-[12px] font-semibold text-ink underline decoration-transparent underline-offset-2 hover:decoration-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {r.code}
                      </Link>
                      <span
                        className="min-w-0 truncate font-mono text-[11.5px] text-ink-muted"
                        title={r.serial}
                      >
                        {r.serial}
                      </span>
                      <span
                        className="min-w-0 truncate font-mono text-[11px] text-ink-muted"
                        title={r.configVersion ?? "—"}
                      >
                        {r.configVersion ?? "—"}
                      </span>
                      <span
                        className={`min-w-0 truncate font-mono text-[11.5px] ${r.keyBad ? "text-ink-strong" : "text-ink"}`}
                      >
                        {r.keyMeasurement}
                      </span>
                      <span>
                        <span
                          className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-bold ${failed ? "text-ink-strong" : "text-success"}`}
                        >
                          <span
                            aria-hidden
                            className={`h-1.5 w-1.5 rounded-full ${failed ? "bg-ink-strong" : "bg-success"}`}
                          />
                          {r.outcome.toUpperCase()}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {(compare || compareErr) && (
        <ComparePanel
          data={compare}
          error={compareErr}
          onClose={() => {
            setCompare(null);
            setCompareErr(null);
          }}
        />
      )}
    </div>
  );
}

// The compare view — side-by-side runs with CONFIG DELTAS highlighted (the frozen
// snapshots made legible). Differing rows carry the accent tint; nothing is red.
function ComparePanel({
  data,
  error,
  onClose,
}: {
  data: CompareData | null;
  error: string | null;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Compare test runs"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-strong/30 p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[86vh] w-full max-w-[860px] overflow-y-auto rounded-card border border-line bg-paper p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold tracking-[-0.02em] text-ink">
            Compare runs · how the builds differed
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-btn border border-line-strong px-3 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:border-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Close
          </button>
        </div>

        {error ? (
          <p role="alert" className="mt-4 text-[13px] text-ink">
            {error}
          </p>
        ) : data ? (
          <>
            <div className="mt-4 flex gap-2">
              {data.runs.map((r) => (
                <div
                  key={r.code}
                  className="flex-1 rounded-[10px] border border-line bg-panel px-3 py-2.5"
                >
                  <div className="font-mono text-[12px] font-semibold text-ink">
                    {r.code}
                  </div>
                  <div className="mt-0.5 font-mono text-[10.5px] text-ink-muted">
                    {r.serial} · {r.configVersion ?? "—"}
                  </div>
                  <div
                    className={`mt-1 font-mono text-[10.5px] font-bold ${r.outcome === "fail" ? "text-ink-strong" : "text-success"}`}
                  >
                    {r.outcome.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>

            <CompareTable
              title="Configuration"
              rows={data.config}
              runs={data.runs}
            />
            <CompareTable
              title="Measurements"
              rows={data.measurements}
              runs={data.runs}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

function CompareTable({
  title,
  rows,
  runs,
}: {
  title: string;
  rows: CompareData["config"];
  runs: CompareData["runs"];
}) {
  const cols = `grid gap-2.5 items-center px-3`;
  const template = { gridTemplateColumns: `1.2fr repeat(${runs.length}, 1fr)` };
  return (
    <section className="mt-5">
      <h3 className="mb-2 font-mono text-[9px] uppercase tracking-[0.06em] text-ink-faint">
        {title}
      </h3>
      <div className="overflow-hidden rounded-[10px] border border-line">
        {rows.map((row, i) => (
          <div
            key={row.key}
            style={template}
            className={`${cols} py-2.5 text-[12px] ${i > 0 ? "border-t border-line" : ""} ${row.differs ? "bg-panel-2" : ""}`}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
              {row.key}
              {row.differs && (
                <span className="ml-1.5 rounded-[4px] bg-accent px-1 py-px text-[8px] font-bold uppercase text-accent-ink">
                  delta
                </span>
              )}
            </span>
            {row.values.map((v, j) => (
              <span
                key={j}
                className={`min-w-0 truncate font-mono text-[11.5px] ${row.differs ? "font-semibold text-ink" : "text-ink-muted"}`}
                title={v ?? "—"}
              >
                {v ?? "—"}
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function FacetChip({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label
      className={`inline-flex items-center gap-1.5 rounded-btn border px-3 py-2 transition-colors ${
        value
          ? "border-ink-strong bg-panel text-ink"
          : "border-line-strong bg-paper text-ink-muted hover:border-ink-strong"
      }`}
    >
      <span className="font-mono text-[9px] uppercase tracking-[0.05em] text-ink-muted">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="max-w-[120px] bg-transparent text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
