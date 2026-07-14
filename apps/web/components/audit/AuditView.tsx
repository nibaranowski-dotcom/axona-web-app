"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { StatStrip } from "@/components/shell/StatStrip";
import { ScreenShell, ScreenMessage } from "@/components/shell/ScreenShell";
import type {
  AuditEntry,
  AuditFilterOptions,
  AuditRollup,
} from "@/lib/audit-trail";
import { LOW_CONFIDENCE } from "@/lib/audit-trail";

export interface AuditScreenData {
  entries: AuditEntry[];
  nextCursor: string | null;
  rollup: AuditRollup;
  options: AuditFilterOptions;
}

// The Governance audit-trail viewer (AUDIT.2) — on the DS.1 primitives (StatStrip +
// a hairline table), brand invariants (Archivo + JetBrains Mono, single lime accent,
// functional green for approved, low-confidence flagged in INK — never red). Read-
// only: the log is immutable (AUDIT.1's DB rules), so there is no edit/delete UI.
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

  const stats = useMemo(
    () => [
      { v: String(data.rollup.total), l: "Entries" },
      { v: String(data.rollup.agentActions), l: "Agent actions" },
      { v: String(data.rollup.humanDecisions), l: "Human decisions" },
      { v: String(data.rollup.approvals), l: "Approvals" },
      { v: String(data.rollup.lowConfidence), l: "Flagged · low conf" },
    ],
    [data.rollup],
  );

  const hasData = entries.length > 0 || data.rollup.total > 0;

  return (
    <ScreenShell
      bodyClassName="gap-3"
      header={
        <>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
              Governance · immutable record
            </div>
            <h1 className="mt-0.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
              Audit trail
            </h1>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-pill border border-line-strong px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
            <ShieldCheck
              className="h-3.5 w-3.5"
              strokeWidth={1.8}
              aria-hidden
            />
            Append-only · read-only
          </span>
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
          <StatStrip stats={stats} />

          {/* filters */}
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              label="Actor"
              value={actor}
              options={data.options.actorTypes}
              onChange={(v) => {
                setActor(v);
                void applyFilters({ actor: v });
              }}
            />
            <FilterSelect
              label="Action"
              value={action}
              options={data.options.actions}
              onChange={(v) => {
                setAction(v);
                void applyFilters({ action: v });
              }}
            />
            <FilterSelect
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
                className="rounded-btn border border-line px-2.5 py-[7px] font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted transition-colors hover:border-ink-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Clear
              </button>
            )}
          </div>

          {/* table — flows with the page (UX.4). The column header pins just below
              the 60px topbar (UX.5). The region must NOT be an overflow scroll
              container: overflow-x/y-auto would trap the header's sticky IN the
              region (it scrolls away instead of pinning). So the columns are
              responsive (minmax, ROW below) and the region simply flows. */}
          <div
            role="region"
            aria-label="Audit entries"
            className="rounded-card border border-line bg-paper"
          >
            <div>
              <div
                className={`${ROW} sticky top-[60px] z-[15] border-b border-line bg-panel py-[11px] font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted`}
              >
                <span>Time</span>
                <span>Actor</span>
                <span>Action</span>
                <span>Target</span>
                <span>Confidence</span>
                <span>Approver</span>
                <span>Summary</span>
              </div>
              {entries.map((e) => (
                <AuditRow key={e.id} e={e} />
              ))}
            </div>
          </div>

          <div className="flex flex-none items-center justify-between font-mono text-[11px] text-ink-muted">
            <span>{entries.length} shown</span>
            {cursor && (
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
        </>
      )}
    </ScreenShell>
  );
}

// Responsive template (UX.5) — no fixed min-width, so the table fits the content
// area without an overflow scroll container (which would trap the sticky header).
const ROW =
  "grid grid-cols-[76px_minmax(110px,1.1fr)_minmax(120px,1.2fr)_minmax(96px,1fr)_92px_minmax(100px,1fr)_minmax(150px,1.9fr)] items-center gap-3 px-4";

function AuditRow({ e }: { e: AuditEntry }) {
  const approved = /\.approve$/.test(e.action);
  const low = e.confidence !== null && e.confidence < LOW_CONFIDENCE;
  return (
    <div className={`${ROW} border-t border-line py-[11px] hover:bg-panel-2`}>
      <span className="font-mono text-[10.5px] text-ink-muted">
        {fmtTime(e.createdAt)}
      </span>
      <span className="min-w-0">
        <ActorBadge type={e.actorType} label={e.actorLabel} />
      </span>
      <span
        className="truncate font-mono text-[11px] text-ink"
        title={e.action}
      >
        {e.action}
      </span>
      <span className="min-w-0 truncate text-[12px]">
        {e.href ? (
          <Link
            href={e.href}
            className="text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {e.targetType}
          </Link>
        ) : (
          <span className="text-ink-muted">{e.targetType}</span>
        )}
      </span>
      <span className="font-mono text-[11px]">
        {e.confidence === null ? (
          <span className="text-ink-faint">—</span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-ink">{e.confidence.toFixed(2)}</span>
            {low && (
              <span className="rounded-pill bg-ink-strong px-1.5 py-px text-[8.5px] font-semibold uppercase tracking-[0.03em] text-on-dark">
                Review
              </span>
            )}
          </span>
        )}
      </span>
      <span className="flex min-w-0 items-center text-[12px]">
        {e.approverLabel ? (
          <span className="flex min-w-0 items-center gap-1.5">
            {approved && (
              <span
                aria-hidden
                className="h-1.5 w-1.5 flex-none rounded-full bg-success"
              />
            )}
            <span className="truncate text-ink" title={e.approverLabel}>
              {e.approverLabel}
            </span>
          </span>
        ) : (
          <span className="text-ink-faint">—</span>
        )}
      </span>
      <span
        className="min-w-0 truncate text-[12.5px] text-ink-muted"
        title={e.summary}
      >
        {e.summary}
      </span>
    </div>
  );
}

function ActorBadge({
  type,
  label,
}: {
  type: AuditEntry["actorType"];
  label: string;
}) {
  const dot =
    type === "AGENT"
      ? "bg-accent"
      : type === "HUMAN"
        ? "bg-ink-strong"
        : "bg-line-strong";
  return (
    // UX.11: block-level `flex` (not inline-flex) so it fills the grid track and
    // the label truncates instead of sizing to max-content + overflowing the cell.
    <span className="flex min-w-0 items-center gap-1.5">
      <span
        aria-hidden
        className={`h-1.5 w-1.5 flex-none rounded-full ${dot}`}
      />
      <span
        className="truncate text-[12px] text-ink"
        title={`${type} · ${label}`}
      >
        {label}
      </span>
    </span>
  );
}

function FilterSelect({
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
    <label className="inline-flex items-center gap-1.5 rounded-btn border border-line-strong bg-paper px-2.5 py-1.5">
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

function fmtTime(at: Date | string): string {
  const d = new Date(at);
  const now = Date.now();
  const s = Math.max(0, Math.floor((now - d.getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
