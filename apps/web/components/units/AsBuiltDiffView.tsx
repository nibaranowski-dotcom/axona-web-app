"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import type { AsBuiltView, AsBuiltRow } from "@/lib/as-built";
import { AgentProposalPanel } from "@/components/agents/AgentProposalPanel";
import { reviewAsBuiltDriftAction } from "@/app/(shell)/units/[serial]/as-built/actions";

// PLM.4 — the as-built diff (`As-Built Diff.dc.html` 1:1 on the DS.1 primitives).
// Answers Q1: "the same robot is not actually the same." Every BOM position
// appears exactly once. Matched lines are DE-EMPHASISED so the eye lands on the
// divergences; substitutions render in INK — never red, never an error state
// (substitution and version churn are the normal case, brand invariant: no
// invented reds). Expanding a position shows the captured who · when · why and
// deep-links the lot into the blast radius.

export function AsBuiltDiffView({ data }: { data: AsBuiltView }) {
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<string | null>(
    // open the first substitution by default — it is why you came here
    data.rows.find((r) => r.isSubstitution)?.position ?? null,
  );

  const visible = showAll
    ? data.rows
    : data.rows.filter((r) => r.isSubstitution);
  const rows = visible.length > 0 ? visible : data.rows;

  return (
    <div className="flex min-h-full flex-col bg-panel">
      <header className="sticky top-0 z-20 flex-none border-b border-line bg-paper px-6 pb-4 pt-[14px]">
        <nav
          aria-label="Breadcrumb"
          className="mb-[9px] flex flex-wrap items-center gap-[7px] font-mono text-[10px] uppercase tracking-[0.05em] text-ink-muted"
        >
          <Link href="/engineering" className="hover:text-ink">
            Engineering
          </Link>
          <span aria-hidden>/</span>
          <Link href="/units" className="hover:text-ink">
            Unit registry
          </Link>
          <span aria-hidden>/</span>
          <Link
            href={`/units/${encodeURIComponent(data.serial)}`}
            className="hover:text-ink"
          >
            {data.serial}
          </Link>
          <span aria-hidden>/</span>
          <span className="text-ink">As-built diff</span>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[19px] font-semibold tracking-[-0.02em] text-ink">
              As-designed vs as-built
            </h1>
            <p className="mt-1 text-[13px] text-ink-muted">
              <span className="font-mono text-[12px]">{data.serial}</span> ·{" "}
              {data.modelName} · against BOM rev {data.designRevision}
            </p>
          </div>
          <div
            role="group"
            aria-label="Which positions to show"
            className="flex gap-2 pb-0.5"
          >
            <Tab active={!showAll} onClick={() => setShowAll(false)}>
              Substitutions only
            </Tab>
            <Tab active={showAll} onClick={() => setShowAll(true)}>
              All positions
            </Tab>
          </div>
        </div>
      </header>

      {/* summary strip */}
      <div className="flex flex-none flex-wrap border-b border-line bg-paper">
        <Stat v={data.summary.positions} l="Positions" />
        <Stat v={data.summary.substitutions} l="Substitutions" divider strong />
        <Stat v={data.summary.lots} l="Lots involved" divider />
        <Stat
          v={data.summary.matching}
          l="Match as-designed"
          divider
          tone="success"
        />
      </div>

      {/* DEMO.6 #2 — the genealogy agent FLAGS the drift instead of leaving the
          reader to spot it in the table. Acknowledging mutates nothing: an as-built
          capture is immutable by design. */}
      {data.agent && (
        <div className="flex-none px-6 pt-5">
          <AgentProposalPanel
            title="As-built genealogy agent"
            proposal={data.agent}
            confirmLabel="Acknowledge drift"
            onDecide={async (upheld) => {
              const r = await reviewAsBuiltDriftAction(data.serial, upheld);
              return r.loopWriteback;
            }}
          />
        </div>
      )}

      <div className="min-w-0 flex-1 overflow-x-auto px-6 pb-6 pt-5">
        <div className="min-w-[860px]">
          {/* column headers */}
          <div className="grid grid-cols-[64px_1fr_1fr_150px]">
            <span />
            <div className="pb-2.5 pl-1">
              <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted">
                As-designed · BOM rev {data.designRevision}
              </span>
            </div>
            <div className="pb-2.5 pl-4">
              <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted">
                As-built · {data.serial}
              </span>
            </div>
            <div className="pb-2.5 pl-4">
              <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted">
                Substitution
              </span>
            </div>
          </div>

          <div className="overflow-hidden rounded-card border border-line bg-paper">
            {rows.map((r, i) => (
              <DiffRow
                key={r.position}
                row={r}
                first={i === 0}
                expanded={open === r.position}
                onToggle={() =>
                  setOpen(open === r.position ? null : r.position)
                }
              />
            ))}
          </div>

          <div className="mt-3.5 flex flex-wrap items-center gap-2 text-[12px] text-ink-muted">
            <span className="inline-flex items-center gap-[7px]">
              <span
                aria-hidden
                className="h-3 w-3 rounded-[3px] bg-ink-strong"
              />
              Substitution
            </span>
            <span aria-hidden className="text-line-strong">
              ·
            </span>
            <span className="inline-flex items-center gap-[7px]">
              <span
                aria-hidden
                className="h-3 w-3 rounded-[3px] bg-line-strong"
              />
              Matched (de-emphasised)
            </span>
            <span className="ml-auto font-mono text-[11px] text-ink-muted">
              Showing {rows.length} of {data.summary.positions} positions
              {!showAll &&
                data.summary.substitutions < data.summary.positions && (
                  <>
                    {" · "}
                    <button
                      type="button"
                      onClick={() => setShowAll(true)}
                      className="text-ink underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      show all
                    </button>
                  </>
                )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DiffRow({
  row,
  first,
  expanded,
  onToggle,
}: {
  row: AsBuiltRow;
  first: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const sub = row.isSubstitution;
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        // No aria-label: the row's own visible text (position · designed · built ·
        // flag) IS the accessible name. An aria-label here would replace it with a
        // shorter string that does not contain the visible words (WCAG 2.5.3).
        className={[
          "grid w-full grid-cols-[64px_1fr_1fr_150px] text-left transition-colors",
          first ? "" : "border-t border-line",
          sub ? "bg-paper" : "bg-paper opacity-60",
          "hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
        ].join(" ")}
      >
        <div className="flex items-center py-[13px] pl-4">
          <span className="font-mono text-[10.5px] text-ink-muted">
            {row.position}
          </span>
        </div>
        {/* the 3px accent edge marks a divergence — ink, never red */}
        <div
          className={`border-l-[3px] py-[13px] pl-1 pr-4 ${sub ? "border-ink-strong" : "border-transparent"}`}
        >
          <div
            className={`font-mono text-[12.5px] text-ink-muted ${sub ? "font-semibold" : ""}`}
          >
            {row.designed
              ? `${row.designed.partNumber} rev ${row.designed.rev}`
              : "— not in BOM"}
          </div>
          <div className="mt-0.5 text-[11px] text-ink-muted">
            {row.designed?.description}
          </div>
        </div>
        <div className="px-4 py-[13px]">
          <div
            className={`font-mono text-[12.5px] text-ink ${sub ? "font-semibold" : ""}`}
          >
            {row.built
              ? `${row.built.partNumber} rev ${row.built.rev}`
              : "— not installed"}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-ink-muted">
            {row.lotCode ? `installed · lot ${row.lotCode}` : "as-designed"}
          </div>
        </div>
        <div className="flex items-center px-4 py-[13px]">
          {sub ? (
            <span className="rounded-[5px] bg-ink-strong px-2 py-[3px] font-mono text-[9px] font-bold tracking-[0.04em] text-on-dark">
              {row.flagLabel}
            </span>
          ) : (
            <span className="inline-flex items-center gap-[5px] text-[11px] text-ink-muted">
              <Check className="h-3 w-3" strokeWidth={2.4} aria-hidden />
              Match
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-line bg-panel-2 py-3 pl-20 pr-4">
          <div className="flex flex-wrap gap-x-[26px] gap-y-3">
            <Detail label="Reason">
              <span className="block max-w-[42ch] text-[12.5px] text-ink">
                {row.reason ??
                  (row.isSubstitution
                    ? "Recorded as a substitution at build; no note captured."
                    : "Built exactly as designed.")}
              </span>
            </Detail>
            <Detail label="Who · when">
              <span className="block font-mono text-[12px] text-ink">
                {[row.installedBy, fmtDate(row.installedAt)]
                  .filter(Boolean)
                  .join(" · ") || "not captured"}
              </span>
            </Detail>
            {row.lotCode && (
              <Detail label="Lot / serial">
                <Link
                  href={`/blast-radius?type=lot&value=${encodeURIComponent(row.lotCode)}`}
                  className="block font-mono text-[12px] text-ink underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  lot {row.lotCode} →
                </Link>
                {row.lotQuarantined && (
                  <span className="mt-1 block font-mono text-[9.5px] uppercase tracking-[0.04em] text-ink">
                    lot on quality hold
                  </span>
                )}
              </Detail>
            )}
            {row.built && (
              <Detail label="Part revision">
                <Link
                  href={`/blast-radius?type=part&value=${encodeURIComponent(
                    `${row.built.partNumber} rev ${row.built.rev}`,
                  )}`}
                  className="block font-mono text-[12px] text-ink underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {row.built.partNumber} rev {row.built.rev} →
                </Link>
                <span className="mt-1 block font-mono text-[9.5px] text-ink-muted">
                  everything carrying this revision
                </span>
              </Detail>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.05em] text-ink-muted">
        {label}
      </div>
      <div className="mt-[3px]">{children}</div>
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "rounded-btn border px-[13px] py-[7px] text-[12.5px] font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        active
          ? "border-ink-strong bg-ink-strong text-on-dark"
          : "border-line-strong bg-paper text-ink-muted hover:border-ink-strong",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Stat({
  v,
  l,
  divider = false,
  strong = false,
  tone,
}: {
  v: number;
  l: string;
  divider?: boolean;
  strong?: boolean;
  tone?: "success";
}) {
  return (
    <div
      className={`min-w-[150px] flex-1 px-6 py-3.5 ${divider ? "border-l border-line" : ""}`}
    >
      <div
        className={`font-mono text-[20px] font-bold tracking-[-0.02em] ${
          tone === "success"
            ? "text-success"
            : strong
              ? "text-ink-strong"
              : "text-ink"
        }`}
      >
        {v}
      </div>
      <div className="mt-[3px] font-mono text-[9px] uppercase tracking-[0.05em] text-ink-muted">
        {l}
      </div>
    </div>
  );
}

function fmtDate(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}
