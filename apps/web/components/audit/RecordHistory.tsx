import { ChevronRight } from "lucide-react";
import type { AuditEntry } from "@/lib/audit-trail";
import { ActorAvatar, ConfidenceCell } from "./audit-parts";

// HIST.1 — the shared per-record "History" timeline. Renders one record's AUDIT.1
// entries (from getRecordHistory — the SAME reader as /audit, filtered by target)
// newest-first: actor · dotted action · summary · relative time; agent entries show
// the AUDIT.3 model + CONF.1-calibrated confidence badge; expand for before→after
// (inputs→output). Read-only — it never writes or mutates the log. Pairs with the
// LINK.1 ConnectedObjects rail. v2 tokens · Lucide thin · no emoji · a labelled,
// keyboard-operable timeline (native <ol> + <details>).

export function RecordHistory({
  entries,
  className,
}: {
  entries: AuditEntry[];
  className?: string;
}) {
  return (
    <section
      aria-labelledby="record-history-title"
      className={`rounded-card border border-line bg-paper p-5 ${className ?? ""}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2
          id="record-history-title"
          className="font-mono text-[10px] uppercase tracking-[0.07em] text-ink-muted"
        >
          History
        </h2>
        {entries.length > 0 && (
          <span className="font-mono text-[11px] font-bold text-ink-strong">
            {entries.length}
          </span>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="mt-3 text-[12px] leading-[1.5] text-ink-muted">
          No changes recorded for this record yet. Every audited action — who
          did what, when, and before→after — appears here.
        </p>
      ) : (
        <ol className="mt-3 flex flex-col">
          {entries.map((e, i) => (
            <HistoryEntry key={e.id} e={e} last={i === entries.length - 1} />
          ))}
        </ol>
      )}
    </section>
  );
}

function HistoryEntry({ e, last }: { e: AuditEntry; last: boolean }) {
  const hasBeforeAfter = isRenderable(e.inputs) || isRenderable(e.output);
  const showAgentMeta =
    e.actorType === "AGENT" && (!!e.model || e.confidence !== null);
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {/* timeline spine */}
      {!last && (
        <span
          aria-hidden
          className="absolute bottom-0 left-[13px] top-[30px] w-px bg-line"
        />
      )}
      <ActorAvatar actorType={e.actorType} actorLabel={e.actorLabel} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[12.5px] font-semibold text-ink">
            {e.actorLabel}
          </span>
          <span className="font-mono text-[10px] text-ink-faint">
            {e.action}
          </span>
          <span
            className="font-mono text-[10px] text-ink-faint"
            title={new Date(e.createdAt).toLocaleString()}
          >
            · {relTime(e.createdAt)}
          </span>
        </div>
        <div className="mt-0.5 text-[12px] leading-[1.4] text-ink-muted">
          {e.summary}
        </div>

        {showAgentMeta && (
          <div className="mt-1 flex items-center gap-2">
            {e.model && (
              <span
                className="font-mono text-[9px] uppercase tracking-[0.04em] text-ink-faint"
                title="model that produced this action (AUDIT.3)"
              >
                {e.model}
              </span>
            )}
            <ConfidenceCell e={e} />
          </div>
        )}
        {e.approverLabel && (
          <div className="mt-0.5 text-[11px] text-ink-faint">
            approved by {e.approverLabel}
          </div>
        )}

        {hasBeforeAfter && (
          <details className="group mt-1.5">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <ChevronRight
                className="h-3 w-3 transition-transform group-open:rotate-90"
                strokeWidth={1.8}
                aria-hidden
              />
              before → after
            </summary>
            <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <KvBlock title="Before" data={e.inputs} />
              <KvBlock title="After" data={e.output} />
            </div>
          </details>
        )}
      </div>
    </li>
  );
}

function KvBlock({ title, data }: { title: string; data: unknown }) {
  const pairs =
    data && typeof data === "object" && !Array.isArray(data)
      ? Object.entries(data as Record<string, unknown>)
      : [];
  return (
    <div className="rounded-[8px] border border-line bg-panel p-2.5">
      <div className="font-mono text-[8.5px] uppercase tracking-[0.05em] text-ink-faint">
        {title}
      </div>
      {pairs.length === 0 ? (
        <div className="mt-1 font-mono text-[11px] text-ink-faint">
          {data == null ? "—" : fmtVal(data)}
        </div>
      ) : (
        <dl className="mt-1 space-y-0.5">
          {pairs.map(([k, v]) => (
            <div key={k} className="flex gap-1.5 font-mono text-[11px]">
              <dt className="flex-none text-ink-faint">{k}</dt>
              <dd className="min-w-0 truncate text-ink" title={fmtVal(v)}>
                {fmtVal(v)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function isRenderable(v: unknown): boolean {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return String(v).length > 0;
}

function fmtVal(v: unknown): string {
  if (v == null) return "—";
  if (Array.isArray(v)) return v.map(fmtVal).join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// Relative time from now — request/render time (no external dep). Coarse buckets.
function relTime(at: Date | string): string {
  const ms = Date.now() - new Date(at).getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  return new Date(at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
