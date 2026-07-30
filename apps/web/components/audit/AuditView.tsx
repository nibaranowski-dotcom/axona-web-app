"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Search } from "lucide-react";
import { ScreenShell, ScreenMessage } from "@/components/shell/ScreenShell";
import type {
  AuditEntry,
  AuditFilterOptions,
  AuditRollup,
  CalibrationModelData,
} from "@/lib/audit-trail";
import { LOW_CONFIDENCE } from "@/lib/audit-trail";
import { ReliabilityPanel } from "./ReliabilityPanel";

export interface AuditScreenData {
  entries: AuditEntry[];
  nextCursor: string | null;
  rollup: AuditRollup;
  options: AuditFilterOptions;
  // CONF.1 — the org's fitted calibration model for the reliability view.
  calibration: CalibrationModelData | null;
}

// AUDIT.4 — the Governance audit trail, rebuilt 1:1 against `Audit Trail.dc.html`
// (v8): a day-grouped, avatar-led log inside a centred 1000px column, with a
// search + filter-chip bar and an Export CSV action. Read-only — the log is
// immutable (AUDIT.1's DB rules), so there is no edit/delete path.
//
// DESIGN ↔ SPEC RECONCILE (flagged for Nicolas): the v8 mock is a clean day-log
// with NO confidence column, NO approver, NO reliability curve and NO stat strip.
// AUDIT.4 requires those to survive. So they are integrated coherently rather than
// bolted on: CONF.1's ReliabilityPanel sits at the TOP of the column (the mock has
// no slot — placement flagged); the calibrated confidence + approver ride INSIDE
// each row (a compact confidence cell + an inline "approved by" on the action
// line). The stat strip is dropped (the mock has none; not an AUDIT.4 must-keep).
// Brand invariants hold: low confidence flags in INK (never red), lime is the one
// accent, functional green marks an approval.

const MODULE_BY_TARGET: Record<string, string> = {
  PurchaseOrder: "Procurement",
  ECO: "Engineering",
  NCR: "Quality",
  Unit: "Manufacturing",
  WorkOrderField: "Field service",
  WorkflowRun: "Workflows",
  MatrixColumn: "Projects",
  File: "Projects",
  Org: "Organization",
  Verify: "System",
};

/** The module chip label (design) — from the target, else the action namespace. */
function moduleOf(e: AuditEntry): string {
  if (MODULE_BY_TARGET[e.targetType]) return MODULE_BY_TARGET[e.targetType]!;
  const ns = e.action.split(".")[0] ?? "";
  return ns ? ns.charAt(0).toUpperCase() + ns.slice(1) : e.targetType;
}

function initials(label: string): string {
  const parts = label
    .trim()
    .split(/[\s·|-]+/)
    .filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function fmtTime(at: Date | string): string {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

function dayLabel(at: Date | string): string {
  const d = new Date(at);
  const now = new Date();
  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

function toCsv(entries: AuditEntry[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const head = [
    "time",
    "actor_type",
    "actor",
    "action",
    "target_type",
    "target_id",
    "confidence_calibrated",
    "confidence_raw",
    "approver",
    "summary",
  ];
  const rows = entries.map((e) =>
    [
      new Date(e.createdAt).toISOString(),
      e.actorType,
      e.actorLabel,
      e.action,
      e.targetType,
      e.targetId,
      e.calibrated ? e.calibrated.value.toFixed(2) : "",
      e.confidence != null ? e.confidence.toFixed(2) : "",
      e.approverLabel ?? "",
      e.summary,
    ]
      .map((c) => esc(String(c)))
      .join(","),
  );
  return [head.join(","), ...rows].join("\n");
}

export function AuditView({
  data,
  error = false,
}: {
  data: AuditScreenData;
  error?: boolean;
}) {
  const [entries, setEntries] = useState<AuditEntry[]>(data.entries);
  const [cursor, setCursor] = useState<string | null>(data.nextCursor);
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const qs = useCallback(
    (extra: Record<string, string>) => {
      const p = new URLSearchParams();
      if (actor) p.set("actor", actor);
      if (action) p.set("action", action);
      if (targetType) p.set("targetType", targetType);
      for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
      return p.toString();
    },
    [actor, action, targetType],
  );

  const applyFilters = useCallback(
    async (next: { actor?: string; action?: string; targetType?: string }) => {
      const a = next.actor ?? actor;
      const ac = next.action ?? action;
      const t = next.targetType ?? targetType;
      setBusy(true);
      try {
        const p = new URLSearchParams();
        if (a) p.set("actor", a);
        if (ac) p.set("action", ac);
        if (t) p.set("targetType", t);
        const res = await fetch(`/api/audit?${p.toString()}`);
        if (!res.ok) return;
        const json = (await res.json()) as {
          entries: AuditEntry[];
          nextCursor: string | null;
        };
        setEntries(json.entries);
        setCursor(json.nextCursor);
      } finally {
        setBusy(false);
      }
    },
    [actor, action, targetType],
  );

  const loadMore = useCallback(async () => {
    if (!cursor || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/audit?${qs({ cursor })}`);
      if (!res.ok) return;
      const json = (await res.json()) as {
        entries: AuditEntry[];
        nextCursor: string | null;
      };
      setEntries((prev) => [...prev, ...json.entries]);
      setCursor(json.nextCursor);
    } finally {
      setBusy(false);
    }
  }, [cursor, busy, qs]);

  // Client-side search over the loaded rows (the design's "Search actor, action,
  // or object" input). Server-side actor/action/target filters still narrow the set.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      `${e.actorLabel} ${e.action} ${e.targetType} ${e.targetId} ${e.summary}`
        .toLowerCase()
        .includes(q),
    );
  }, [entries, search]);

  // Group into days (entries are newest-first, so groups stay in order).
  const days = useMemo(() => {
    const out: { label: string; events: AuditEntry[] }[] = [];
    for (const e of visible) {
      const label = dayLabel(e.createdAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.events.push(e);
      else out.push({ label, events: [e] });
    }
    return out;
  }, [visible]);

  const exportCsv = useCallback(() => {
    const blob = new Blob([toCsv(entries)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audit-trail.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [entries]);

  const hasData = entries.length > 0 || data.rollup.total > 0;

  return (
    <ScreenShell
      bodyClassName="gap-0 px-0 pt-0"
      header={
        <>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
              Workspace · immutable log
            </div>
            <h1 className="mt-0.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
              Audit trail
            </h1>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            disabled={entries.length === 0}
            className="inline-flex items-center gap-2 rounded-btn border border-line-strong bg-paper px-3.5 py-2 text-[12.5px] font-semibold text-ink-muted transition-colors hover:border-ink-strong hover:text-ink disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden />
            Export CSV
          </button>
        </>
      }
    >
      {error ? (
        <ScreenMessage>
          <p role="status" className="text-sm text-ink-muted">
            Couldn’t load the audit trail. Check the database and refresh.
          </p>
        </ScreenMessage>
      ) : !hasData ? (
        <ScreenMessage>
          <p className="text-sm text-ink-muted">
            No audit entries — run the seed (
            <span className="font-mono">pnpm db:seed</span>).
          </p>
        </ScreenMessage>
      ) : (
        <>
          {/* filter bar — pinned below the 60px topbar (UX.5) */}
          <div className="sticky top-[60px] z-[15] flex flex-wrap items-center gap-3 border-b border-line bg-paper px-6 py-3.5">
            <label className="flex min-w-[220px] flex-1 items-center gap-2.5 rounded-[9px] border border-line-strong bg-panel px-3 focus-within:border-ink-strong focus-within:ring-2 focus-within:ring-accent">
              <Search
                className="h-3.5 w-3.5 flex-none text-ink-faint"
                strokeWidth={2}
                aria-hidden
              />
              <span className="sr-only">Search actor, action, or object</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search actor, action, or object"
                className="min-w-0 flex-1 border-none bg-transparent py-2.5 text-[13px] text-ink outline-none placeholder:text-ink-faint"
              />
            </label>
            <FilterChip
              label="Actor"
              value={actor}
              options={data.options.actorTypes}
              onChange={(v) => {
                setActor(v);
                void applyFilters({ actor: v });
              }}
            />
            <FilterChip
              label="Action"
              value={action}
              options={data.options.actions}
              onChange={(v) => {
                setAction(v);
                void applyFilters({ action: v });
              }}
            />
            <FilterChip
              label="Target"
              value={targetType}
              options={data.options.targetTypes}
              onChange={(v) => {
                setTargetType(v);
                void applyFilters({ targetType: v });
              }}
            />
            {(actor || action || targetType) && (
              <button
                type="button"
                onClick={() => {
                  setActor("");
                  setAction("");
                  setTargetType("");
                  void applyFilters({ actor: "", action: "", targetType: "" });
                }}
                className="rounded-pill border border-line px-2.5 py-[7px] font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted transition-colors hover:border-ink-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Clear
              </button>
            )}
          </div>

          {/* centred 1000px column (design) */}
          <div className="mx-auto w-full max-w-[1000px] px-6 pb-6">
            {/* CONF.1 — the reliability view. The v8 mock has no slot for it, so it
                is placed at the top of the column (placement flagged for review). */}
            <div className="pt-5">
              <ReliabilityPanel calibration={data.calibration} />
            </div>

            {days.length === 0 ? (
              <p className="py-14 text-center text-[13px] text-ink-muted">
                No entries match your search.
              </p>
            ) : (
              days.map((d) => (
                <section key={d.label} aria-label={d.label}>
                  <div className="mt-5 mb-1 flex items-center gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-faint">
                      {d.label}
                    </span>
                    <span className="h-px flex-1 bg-line" aria-hidden />
                  </div>
                  {d.events.map((e) => (
                    <AuditRow key={e.id} e={e} />
                  ))}
                </section>
              ))
            )}

            <div className="mt-5 flex items-center justify-between font-mono text-[11px] text-ink-muted">
              <span>{visible.length} shown</span>
              {cursor && !search && (
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={busy}
                  className="rounded-btn border border-line-strong px-3 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:border-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
                >
                  {busy ? "Loading…" : "Load more"}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </ScreenShell>
  );
}

// The row grid keeps the design's rhythm (avatar · action+object · module · time)
// and inserts a compact CONF.1 confidence cell. Every text cell is min-w-0 +
// truncate + title (UX.11) so nothing collides — including with the agent pane open.
const ROW =
  "grid grid-cols-[minmax(150px,1.4fr)_minmax(0,2.4fr)_92px_minmax(96px,1fr)_58px] items-center gap-3.5 border-b border-line px-3 py-3 hover:bg-panel-2";

function AuditRow({ e }: { e: AuditEntry }) {
  const approved = /\.approve$/.test(e.action);
  const av =
    e.actorType === "AGENT"
      ? "bg-accent text-accent-ink"
      : e.actorType === "HUMAN"
        ? "bg-ink-strong text-on-dark"
        : "bg-panel text-ink-muted border border-line-strong";

  return (
    <div className={ROW}>
      {/* actor */}
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden
          className={`inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full font-mono text-[9px] font-bold ${av}`}
        >
          {initials(e.actorLabel)}
        </span>
        <span
          className="min-w-0 truncate text-[12.5px] font-semibold text-ink"
          title={`${e.actorType} · ${e.actorLabel}`}
        >
          {e.actorLabel}
        </span>
      </div>

      {/* action + object (+ approver folded in) */}
      <div className="min-w-0 truncate text-[13px] text-ink" title={e.summary}>
        {e.summary}{" "}
        {e.href ? (
          <Link
            href={e.href}
            className="font-mono text-[11.5px] text-ink-muted underline decoration-line-strong underline-offset-2 hover:decoration-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {e.targetType}
          </Link>
        ) : (
          <span className="font-mono text-[11.5px] text-ink-muted">
            {e.targetType}
          </span>
        )}
        {e.approverLabel && (
          <span className="text-[11.5px] text-ink-muted">
            {" · "}
            {approved && (
              <span
                aria-hidden
                className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-success align-middle"
              />
            )}
            approved by {e.approverLabel}
          </span>
        )}
      </div>

      {/* CONF.1 — calibrated confidence, raw-divergence hint, cold-start marker */}
      <span className="font-mono text-[11px]">
        {e.confidence === null ? (
          <span className="text-ink-faint">—</span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <span className="text-ink">
              {(e.calibrated?.value ?? e.confidence).toFixed(2)}
            </span>
            {e.calibrated?.state === "uncalibrated" ? (
              <span
                title={`raw ${e.confidence.toFixed(2)} · not enough decided proposals to calibrate yet`}
                className="rounded-[4px] border border-line px-1 py-px text-[8px] font-medium uppercase tracking-[0.03em] text-ink-muted"
              >
                uncal
              </span>
            ) : e.calibrated &&
              Math.abs(e.calibrated.value - e.confidence) >= 0.05 ? (
              <span
                title={`agent said ${e.confidence.toFixed(2)}; calibrated to the org's observed rate`}
                className="text-[9px] text-ink-faint"
              >
                ·raw {e.confidence.toFixed(2)}
              </span>
            ) : null}
            {e.confidence < LOW_CONFIDENCE && (
              <span className="rounded-pill bg-ink-strong px-1.5 py-px text-[8.5px] font-semibold uppercase tracking-[0.03em] text-on-dark">
                Review
              </span>
            )}
          </span>
        )}
      </span>

      {/* module chip */}
      <span className="min-w-0 justify-self-start">
        <span
          className="inline-block max-w-full truncate rounded-[5px] border border-line-panel bg-panel px-[7px] py-0.5 font-mono text-[10px] uppercase tracking-[0.03em] text-ink-muted"
          title={moduleOf(e)}
        >
          {moduleOf(e)}
        </span>
      </span>

      {/* time */}
      <span className="justify-self-end font-mono text-[10.5px] text-ink-faint">
        {fmtTime(e.createdAt)}
      </span>
    </div>
  );
}

function FilterChip({
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
      className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-[7px] transition-colors ${
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
        onChange={(ev) => onChange(ev.target.value)}
        className="bg-transparent text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
