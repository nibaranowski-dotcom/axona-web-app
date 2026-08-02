"use client";

import { useCallback, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronDown, Search } from "lucide-react";
import {
  FILTER_KEYS,
  STATUS_LABEL,
  type FilterKey,
  type UnitRegistryData,
} from "@/lib/units";
import { DenseTable, FROZEN_CELL } from "@/components/ui";
import { ScreenShell } from "@/components/shell/ScreenShell";
import { ImportUnitsPanel } from "./ImportUnitsPanel";

// PLM.2 — the Unit registry (`Unit Registry.dc.html` 1:1 on the DS.1 primitives).
// The screen IS the query that sells the product: combinable filters over model ·
// config version · sw version · lot · site · status, every one of them URL-
// addressable so a filtered registry is a link you can paste into an incident
// thread. Rows go to the Unit page (PLM.3).
//
// Registry ≠ Fleet: this spans BUILT + DEPLOYED units; Fleet stays deployed-ops
// (map/telemetry). No map here by design.

const FACET_LABEL: Record<FilterKey, string> = {
  model: "Model",
  config: "Config version",
  sw: "SW version",
  lot: "Lot",
  site: "Site",
  status: "Status",
};

export function UnitRegistryView({
  data,
  canImport,
  error = false,
}: {
  data: UnitRegistryData;
  canImport: boolean;
  error?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  // Every filter change is a URL change — that is what makes the view shareable.
  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete("page"); // a new filter always lands on page 1
      const qs = next.toString();
      startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
    },
    [params, pathname, router],
  );

  const active = FILTER_KEYS.filter((k) => params.get(k)).map((k) => ({
    key: k,
    value: params.get(k)!,
  }));
  const q = params.get("q") ?? "";
  const hasFilters = active.length > 0 || q.length > 0;
  const isEmptyRegistry = data.total === 0;

  return (
    <ScreenShell
      bodyClassName="!gap-0 !px-0 !pt-0"
      header={
        <>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
              Engineering · PLM · built + deployed
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
              Unit registry
            </h1>
          </div>
          <div className="flex items-center gap-[10px]">
            {canImport && (
              <ImportUnitsPanel exampleModel={data.facets.model[0]} />
            )}
            <ExportViewButton rows={data.rows} />
          </div>
        </>
      }
    >
      {error ? (
        <div className="flex min-h-[55vh] items-center justify-center px-6">
          <p role="status" className="text-sm text-ink-muted">
            Couldn’t load the unit registry. Check the database and refresh.
          </p>
        </div>
      ) : isEmptyRegistry ? (
        <EmptyRegistry canImport={canImport} />
      ) : (
        <>
          {/* filter bar — the product */}
          <div className="flex flex-none flex-col gap-[11px] border-b border-line bg-paper px-6 py-[13px]">
            <div className="flex flex-wrap items-center gap-[10px]">
              <form
                action={pathname}
                className="flex min-w-[220px] flex-1 items-center gap-[9px] rounded-[9px] border border-line-strong bg-panel px-3 focus-within:border-ink-strong"
              >
                <Search
                  className="h-3.5 w-3.5 flex-none text-ink-muted"
                  strokeWidth={2}
                  aria-hidden
                />
                <label htmlFor="unit-q" className="sr-only">
                  Search units by serial, customer or lot
                </label>
                <input
                  id="unit-q"
                  name="q"
                  type="search"
                  defaultValue={q}
                  placeholder="Search serial, customer, lot…"
                  className="min-w-0 flex-1 border-none bg-transparent py-[9px] text-[13px] text-ink outline-none placeholder:text-ink-muted"
                />
                {/* keep the other active filters when submitting the search */}
                {active.map((a) => (
                  <input
                    key={a.key}
                    type="hidden"
                    name={a.key}
                    value={a.value}
                  />
                ))}
              </form>
              {FILTER_KEYS.map((key) => (
                <FacetSelect
                  key={key}
                  label={FACET_LABEL[key]}
                  value={params.get(key) ?? ""}
                  options={data.facets[key]}
                  format={key === "status" ? statusLabel : undefined}
                  onChange={(v) => setParam(key, v || null)}
                />
              ))}
            </div>

            {/* active filter chips */}
            {hasFilters && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted">
                  Active
                </span>
                {q && (
                  <ActiveChip
                    label={`search = ${q}`}
                    onClear={() => setParam("q", null)}
                  />
                )}
                {active.map((a) => (
                  <ActiveChip
                    key={a.key}
                    label={`${FACET_LABEL[a.key].toLowerCase()} = ${
                      a.key === "status" ? statusLabel(a.value) : a.value
                    }`}
                    onClear={() => setParam(a.key, null)}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => startTransition(() => router.push(pathname))}
                  className="ml-0.5 text-[11.5px] text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* results count */}
          <div
            aria-live="polite"
            className="flex flex-none items-baseline gap-2 px-6 pb-2 pt-3"
          >
            <span className="font-mono text-[19px] font-bold tracking-[-0.02em] text-ink">
              {data.matched}
            </span>
            <span className="text-[12.5px] text-ink-muted">
              unit{data.matched === 1 ? "" : "s"} match · of {data.total} in
              registry
            </span>
          </div>

          <div
            className={`min-w-0 flex-1 px-6 pb-6 ${pending ? "opacity-60" : ""}`}
          >
            {data.rows.length === 0 ? (
              <NoMatches
                onClear={() => startTransition(() => router.push(pathname))}
              />
            ) : (
              <UnitTable data={data} />
            )}
            <Pagination
              data={data}
              onPage={(p) => setParam("page", String(p))}
            />
          </div>
        </>
      )}
    </ScreenShell>
  );
}

function statusLabel(s: string): string {
  return STATUS_LABEL[s] ?? s;
}

// TABLE.3b — content-independent tracks (the UX.16 rule): a bare `Nfr` is
// `minmax(auto, Nfr)`, whose floor is the track's own min-content, so rows inflate
// their tracks while the short header labels do not and the two drift apart off one
// template. Floors are each column's MEASURED max-content (Serial 60 · Model 30 ·
// Config 90 · SW 60 · Status 61 · Issues 36 · Last event 60), every one already below
// the width that column resolves to — so this is a no-op at wide widths and the
// floors only bind once the table scrolls. Site/customer is long free text and stays
// `minmax(0, …)` so it truncates exactly as today.
const COLS =
  "grid grid-cols-[minmax(60px,1fr)_minmax(30px,0.9fr)_minmax(90px,1.1fr)_minmax(60px,0.9fr)_minmax(0,1.3fr)_minmax(61px,1fr)_minmax(36px,0.7fr)_minmax(60px,1fr)] gap-3 px-[18px]";
// The floor is the same BOX as before, expressed against its new owner. It used to
// sit on a wrapper OUTSIDE the card, so 1000px was the card's border-box; now it sits
// on the card's scrollable content, inside the 1px borders — 998px keeps the card
// exactly 1000px and the eight tracks resolving against exactly the width they did
// before, which is what holds 1440 at parity. (Change Orders.dc.html states its floor
// as a content width for the same reason — there the two happen to coincide.)
const UNITS_MIN_W = "min-w-[998px]";

// TABLE.3b — the canonical dense-table shell (design note 2026-08-01, recorded in
// specs/design-brief-dense-table-frozen-columns.md): the rounded card IS the
// horizontal scroller — border-radius + overflow-x on ONE element. The first cut of
// this screen nested an `overflow-hidden` card between the sticky cell and the
// scrollport, which made `position: sticky` resolve against the card (it scrolled as
// a unit) and pin nothing. `overflow-x` still clips the rounded corners, so the card
// keeps its shape without a second clipping box.
const CARD = "rounded-card border border-line bg-paper";
// The frozen cell is `bg-inherit`, so header and rows must paint an EXPLICIT opaque
// background for content to occlude cleanly under it — and the row's follows :hover
// to panel-2, which the pinned cell then inherits with it.
const HEADER_BG = "bg-paper";
const ROW_BG = "bg-paper hover:bg-panel-2";
// Same pinned-identifier mechanics as the PO queue (UX.17), at this table's padding.
const FROZEN_SERIAL = FROZEN_CELL["px-[18px]"];

function UnitTable({ data }: { data: UnitRegistryData }) {
  return (
    <DenseTable
      minWidth={UNITS_MIN_W}
      label="Unit registry"
      className={`min-w-0 ${CARD}`}
    >
      <>
        <div
          className={`${COLS} ${HEADER_BG} border-b border-line py-[11px] font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted`}
        >
          <span className={FROZEN_SERIAL}>Serial</span>
          <span>Model</span>
          <span>Config version</span>
          <span>SW version</span>
          <span>Site / customer</span>
          <span>Status</span>
          <span>Issues</span>
          <span>Last event</span>
        </div>
        {data.rows.map((u) => (
          <Link
            key={u.serial}
            href={`/units/${encodeURIComponent(u.serial)}`}
            className={`${COLS} ${ROW_BG} items-center border-t border-line py-[13px] text-ink transition-colors first:border-t-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent`}
          >
            <span
              className={`${FROZEN_SERIAL} font-mono text-[12.5px] font-semibold`}
            >
              {u.serial}
            </span>
            <span className="min-w-0 truncate text-[12.5px] text-ink-muted">
              {u.modelCode}
            </span>
            <span className="font-mono text-[11.5px]">
              {u.configVersion ?? "—"}
            </span>
            <span className="font-mono text-[11.5px]">
              {u.swVersion ?? "—"}
            </span>
            <span className="min-w-0 truncate text-[12.5px] text-ink-muted">
              {[u.customer, u.site].filter(Boolean).join(" · ") || "—"}
            </span>
            <span>
              <StatusDot status={u.status} />
            </span>
            <span>
              {u.openIssues > 0 ? (
                <span className="font-mono text-[11px] font-bold text-ink-strong">
                  {u.openIssues}
                </span>
              ) : (
                <span className="font-mono text-[11px] text-ink-muted">—</span>
              )}
            </span>
            <span className="font-mono text-[10.5px] text-ink-muted">
              {relative(u.lastEventAt)}
            </span>
          </Link>
        ))}
      </>
    </DenseTable>
  );
}

// Deployed = the functional green (live); everything else is ink/accent. No
// invented reds — a unit on hold reads in ink, not red (brand invariant).
function StatusDot({ status }: { status: string }) {
  const tone =
    status === "deployed" || status === "active"
      ? "text-success"
      : status === "in_build"
        ? "text-ink-strong"
        : "text-ink-muted";
  const dot =
    status === "deployed" || status === "active"
      ? "bg-success"
      : status === "in_build"
        ? "bg-accent"
        : "bg-line-strong";
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${tone}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {statusLabel(status)}
    </span>
  );
}

function FacetSelect({
  label,
  value,
  options,
  format,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  format?: (v: string) => string;
  onChange: (v: string) => void;
}) {
  const selected = value.length > 0;
  return (
    <span className="relative inline-flex">
      <label className="sr-only" htmlFor={`facet-${label}`}>
        Filter by {label}
      </label>
      <select
        id={`facet-${label}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={[
          "appearance-none rounded-btn border py-2 pl-[13px] pr-[30px] font-sans text-[12.5px] font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          selected
            ? "border-ink-strong bg-ink-strong text-on-dark"
            : "border-line-strong bg-paper text-ink-muted hover:border-ink-strong",
        ].join(" ")}
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {format ? format(o) : o}
          </option>
        ))}
      </select>
      <ChevronDown
        className={`pointer-events-none absolute right-[11px] top-1/2 h-3 w-3 -translate-y-1/2 ${
          selected ? "text-on-dark" : "text-ink-muted"
        }`}
        strokeWidth={2}
        aria-hidden
      />
    </span>
  );
}

function ActiveChip({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-pill bg-ink-strong py-1 pl-[10px] pr-1.5 font-mono text-[11px] text-on-dark">
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Clear ${label}`}
        className="rounded-full px-1 leading-none text-on-dark-mut transition-colors hover:text-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        ×
      </button>
    </span>
  );
}

function Pagination({
  data,
  onPage,
}: {
  data: UnitRegistryData;
  onPage: (p: number) => void;
}) {
  const pages = Math.ceil(data.matched / data.pageSize);
  if (pages <= 1) return null;
  return (
    <nav
      aria-label="Registry pages"
      className="mt-3 flex items-center justify-end gap-2"
    >
      <span className="font-mono text-[10.5px] text-ink-muted">
        Page {data.page} of {pages}
      </span>
      <PageBtn
        label="Previous page"
        disabled={data.page <= 1}
        onClick={() => onPage(data.page - 1)}
      >
        Previous
      </PageBtn>
      <PageBtn
        label="Next page"
        disabled={data.page >= pages}
        onClick={() => onPage(data.page + 1)}
      >
        Next
      </PageBtn>
    </nav>
  );
}

function PageBtn({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-btn border border-line-strong px-3 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:border-ink-strong disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {children}
    </button>
  );
}

function NoMatches({ onClear }: { onClear: () => void }) {
  return (
    <div className="rounded-card border border-line bg-paper px-6 py-14 text-center">
      <p className="text-[13.5px] font-semibold text-ink">
        No units match these filters.
      </p>
      <p className="mx-auto mt-1.5 max-w-[46ch] text-[12.5px] leading-[1.5] text-ink-muted">
        Filters combine — narrow one at a time, or clear them to see the whole
        registry.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="mt-4 rounded-btn border border-line-strong px-4 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:border-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Clear all filters
      </button>
    </div>
  );
}

// Import-first: an empty registry is a real first-run surface, not an apology.
// Time-to-value is the reason buyers reject incumbent PLM.
function EmptyRegistry({ canImport }: { canImport: boolean }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="max-w-[520px] text-center">
        <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted">
          First run
        </div>
        <h2 className="mt-2 text-[19px] font-semibold tracking-[-0.02em] text-ink">
          Bring your units in from a CSV.
        </h2>
        <p className="mx-auto mt-2.5 max-w-[46ch] text-[13px] leading-[1.55] text-ink-muted">
          One row per unit — serial, model, status, and optionally build date,
          site and customer. The import is checked row by row before anything is
          written, so a malformed file costs you nothing.
        </p>
        <div className="mt-5 flex items-center justify-center gap-[10px]">
          {canImport ? (
            <ImportUnitsPanel />
          ) : (
            <p className="text-[12.5px] text-ink-muted">
              Ask an engineer or admin to run the first import.
            </p>
          )}
        </div>
        <p className="mt-6 font-mono text-[10.5px] text-ink-muted">
          serial,model,status,builddate,sitelabel,customerlabel
        </p>
      </div>
    </div>
  );
}

// "Export view" exports exactly what is on screen — the filtered rows, in the
// same column order, as the CSV shape importUnits reads back. Round-trippable by
// construction; no server round-trip, no invented export pipeline.
function ExportViewButton({ rows }: { rows: UnitRegistryData["rows"] }) {
  const download = () => {
    const header =
      "serial,model,status,configversion,swversion,sitelabel,customerlabel,lots";
    const esc = (v: string) => (v.includes(",") ? `"${v}"` : v);
    const body = rows.map((r) =>
      [
        r.serial,
        r.modelCode,
        r.status,
        r.configVersion ?? "",
        r.swVersion ?? "",
        r.site ?? "",
        r.customer ?? "",
        r.lots.join(" "),
      ]
        .map((v) => esc(String(v)))
        .join(","),
    );
    const blob = new Blob([[header, ...body].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "unit-registry.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button
      type="button"
      onClick={download}
      disabled={rows.length === 0}
      className="rounded-btn border border-ink-strong bg-ink-strong px-[15px] py-[9px] text-[13px] font-semibold text-on-dark transition-colors hover:bg-black disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      Export view
    </button>
  );
}

/** Mono, specific — reads like a machine reported it (the v2 voice). */
function relative(d: Date | null): string {
  if (!d) return "—";
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  return `${days}d ago`;
}
