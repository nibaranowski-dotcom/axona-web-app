"use client";

import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";
import type { UnitDetail, TimelineKind } from "@/lib/unit-detail";
import { STATUS_LABEL } from "@/lib/units";
import { ConnectedObjects } from "@/components/ontology/ConnectedObjects";
import type { ConnectedGroup } from "@/lib/connected-objects";
import { RecordHistory } from "@/components/audit/RecordHistory";
import type { AuditEntry } from "@/lib/audit-trail";
import { Attachments } from "@/components/attachments/Attachments";
import type { RecordAttachments } from "@/lib/attachments";

// PLM.3 — the Unit page (`Unit.dc.html` 1:1 on the DS.1 primitives). THE hero
// object: everything in PLM links here. Identity + the configuration resolved NOW,
// the as-designed↔as-built divergence, and a lifecycle timeline where every row
// carries the configuration THAT unit was running at THAT moment.
//
// Test runs and field events are PLM.1b — their sections render as an explicit,
// honest empty seam rather than fake rows.

export function UnitView({
  unit,
  connected,
  history,
  attachments,
  canManage,
}: {
  unit: UnitDetail;
  connected: ConnectedGroup[];
  history: AuditEntry[];
  attachments: RecordAttachments;
  canManage: boolean;
}) {
  const subCount = unit.diff.summary.substitutions;

  return (
    <div className="flex min-h-full flex-col bg-panel">
      {/* identity header */}
      <header className="sticky top-0 z-20 flex-none border-b border-line bg-paper px-6 pb-4 pt-[14px]">
        <nav
          aria-label="Breadcrumb"
          className="mb-[9px] flex items-center gap-[7px] font-mono text-[10px] uppercase tracking-[0.05em] text-ink-muted"
        >
          <Link href="/engineering" className="hover:text-ink">
            Engineering
          </Link>
          <span aria-hidden>/</span>
          <Link href="/units" className="hover:text-ink">
            Unit registry
          </Link>
          <span aria-hidden>/</span>
          <span className="text-ink">{unit.serial}</span>
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-mono text-[22px] font-bold tracking-[-0.03em] text-ink">
                {unit.serial}
              </h1>
              <StatusPill status={unit.status} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-[13px] text-ink-muted">
              <span>{unit.modelName}</span>
              <Sep />
              <span>
                Built{" "}
                <span className="font-mono text-[12px]">
                  {fmtDate(unit.buildDate)}
                </span>
              </span>
              {(unit.customer || unit.site) && (
                <>
                  <Sep />
                  <span>
                    {[unit.customer, unit.site].filter(Boolean).join(" · ")}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-2.5">
            <Link
              href={`/units/${encodeURIComponent(unit.serial)}/as-built`}
              className="rounded-btn border border-line-strong bg-transparent px-[15px] py-[9px] text-[13px] font-semibold text-ink transition-colors hover:border-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              View as-built diff
            </Link>
            <Link
              href={`/blast-radius?type=unit&value=${encodeURIComponent(unit.serial)}`}
              className="rounded-btn border border-ink-strong bg-ink-strong px-[15px] py-[9px] text-[13px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Blast radius
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        {/* main column */}
        <div className="flex min-w-0 flex-1 flex-col gap-[18px] px-6 pb-16 pt-[22px]">
          <CurrentConfig unit={unit} />
          <BuildReadinessCard unit={unit} />
          <DiffSummary unit={unit} subCount={subCount} />
          <Lifecycle unit={unit} />
        </div>

        {/* right context rail */}
        <aside className="flex w-full flex-none flex-col gap-[22px] border-line bg-paper p-5 lg:w-[312px] lg:border-l">
          <RailSection
            label="Open issues"
            right={
              <span className="font-mono text-[11px] font-bold text-ink-strong">
                {unit.issues.length}
              </span>
            }
          >
            {unit.issues.length === 0 ? (
              <RailEmpty>No open non-conformances on this unit.</RailEmpty>
            ) : (
              unit.issues.map((n) => (
                <div
                  key={n.code}
                  className="overflow-hidden rounded-[10px] border border-line"
                >
                  <Link
                    href="/quality"
                    className="block p-3 transition-colors hover:bg-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[12px] font-semibold text-ink">
                        {n.code}
                      </span>
                      <span className="rounded-pill bg-ink-strong px-2 py-0.5 text-[10px] font-semibold capitalize text-on-dark">
                        {n.severity.toLowerCase()}
                      </span>
                    </div>
                    <div className="mt-1.5 text-[12px] leading-[1.4] text-ink-muted">
                      {n.defect}
                    </div>
                  </Link>
                  {/* DEMO.5 — one-click reach to the root-cause workspace from the unit's
                      failure panel. Read-only view (no write RBAC widened). Only when the
                      NCR has an RCA workspace. */}
                  {n.hasRca && (
                    <Link
                      href={`/rca/${encodeURIComponent(n.code)}`}
                      className="block border-t border-line px-3 py-2 font-mono text-[10.5px] font-semibold text-ink transition-colors hover:bg-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      Open RCA →
                    </Link>
                  )}
                </div>
              ))
            )}
          </RailSection>

          {/* PLM.1b seam — real TestRun rows land here; no fake rows meanwhile. */}
          <RailSection label="Test runs">
            {unit.testRuns.length === 0 ? (
              <RailEmpty>
                No test runs recorded against this unit yet.
              </RailEmpty>
            ) : (
              unit.testRuns.map((t) => (
                <div
                  key={t.code}
                  className="flex items-center gap-2.5 rounded-[10px] border border-line px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[11.5px] font-semibold text-ink">
                      {t.code}
                    </div>
                    <div className="mt-px text-[11px] text-ink-muted">
                      {t.name}
                    </div>
                  </div>
                  <span className="font-mono text-[10px] font-semibold text-ink">
                    {t.outcome}
                  </span>
                </div>
              ))
            )}
          </RailSection>

          <RailSection label="Change orders">
            {unit.changeOrders.length === 0 ? (
              <RailEmpty>No change orders reach this unit.</RailEmpty>
            ) : (
              unit.changeOrders.map((e) => (
                <Link
                  key={e.code}
                  href="/engineering"
                  className="flex items-center gap-2.5 rounded-[10px] border border-line px-3 py-2.5 transition-colors hover:bg-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[11.5px] font-semibold text-ink">
                      {e.code}
                    </div>
                    <div className="mt-px truncate text-[11px] text-ink-muted">
                      {e.title}
                    </div>
                    {!e.appliesToThisUnit && e.effectiveFromSerial && (
                      <div className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.04em] text-ink-muted">
                        outside effectivity
                      </div>
                    )}
                  </div>
                  <span className="flex-none rounded-[5px] border border-line-panel bg-panel px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.03em] text-ink-muted">
                    {e.stage.toLowerCase()}
                  </span>
                </Link>
              ))
            )}
          </RailSection>

          {/* LINK.1 — directly connected records across the graph (1-hop). */}
          <ConnectedObjects groups={connected} />

          {/* HIST.1 — this record's audited change history (AUDIT.1). */}
          <RecordHistory entries={history} />

          {/* ATTACH.1 — files attached to this record (FILE.1 extended). */}
          <Attachments attachments={attachments} canManage={canManage} />
        </aside>
      </div>
    </div>
  );
}

// ── current configuration (pinned) ──────────────────────────────────────────
function CurrentConfig({ unit }: { unit: UnitDetail }) {
  const cfg = unit.current.configVersion;
  return (
    <section className="overflow-hidden rounded-card border border-line bg-paper">
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line px-5 pb-[13px] pt-[15px]">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-[15px] font-semibold text-ink">
            Current configuration
          </h2>
          {cfg?.isBaseline && (
            <span className="inline-flex items-center gap-1.5 rounded-[5px] border border-line-panel bg-panel px-[7px] py-0.5 font-mono text-[9.5px] uppercase tracking-[0.04em] text-ink-muted">
              <Lock className="h-2.5 w-2.5" strokeWidth={2.2} aria-hidden />
              Baseline · locked
            </span>
          )}
        </div>
        <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted">
          RESOLVED AS OF NOW
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3">
        <ConfigCell
          label="Config version"
          value={cfg?.name ?? "—"}
          note={
            cfg
              ? unit.configBaselinedAt
                ? `Baselined ${fmtDate(unit.configBaselinedAt)}`
                : "Not baselined"
              : "No named configuration matches this build"
          }
          divider
        />
        <ConfigCell
          label="Hardware"
          value={`${unit.modelCode} · rev ${unit.diff.lines.length > 0 ? currentHwRev(unit) : "—"}`}
          note={`${unit.diff.summary.positions} components · ${unit.diff.summary.substitutions} substitution${unit.diff.summary.substitutions === 1 ? "" : "s"}`}
          divider
        />
        <ConfigCell
          label="Software / firmware"
          value={unit.current.sw?.version ?? "—"}
          note={
            unit.current.sw
              ? `${unit.current.sw.component} · resolved from capture`
              : "No software state recorded"
          }
        />
      </div>
    </section>
  );
}

/** The as-designed revision this unit's model is at (the diff's baseline). */
function currentHwRev(unit: UnitDetail): string {
  return unit.diff.lines[0]?.expected?.rev ?? "—";
}

// ── build readiness (BR.1) ──────────────────────────────────────────────────
// BOM × on-hand × open-PO coverage, rolled up per line. The bar reads left→right:
// in-house (have) · on order (coming) · late (past promised) · short (no cover).
// No invented reds — late is ink, short is a hairline stripe. Recomputes live: a
// goods-receipt on the Procurement queue bumps stock and this card ticks up.
const READINESS_SEGMENTS: {
  key: "in_house" | "on_order" | "late" | "missing";
  label: string;
  swatch: string;
  style?: React.CSSProperties;
}[] = [
  { key: "in_house", label: "In-house", swatch: "bg-success" },
  { key: "on_order", label: "On order", swatch: "bg-line-strong" },
  { key: "late", label: "Late", swatch: "bg-ink-strong" },
  {
    key: "missing",
    label: "Short",
    swatch: "",
    style: {
      backgroundImage:
        "repeating-linear-gradient(45deg, var(--line-strong) 0, var(--line-strong) 1.5px, transparent 1.5px, transparent 5px)",
      backgroundColor: "var(--panel)",
    },
  },
];

function BuildReadinessCard({ unit }: { unit: UnitDetail }) {
  const r = unit.buildReadiness;
  const blocking = r.blockingParts;
  const pctByKey: Record<(typeof READINESS_SEGMENTS)[number]["key"], number> = {
    in_house: r.pctInHouse,
    on_order: r.pctOnOrder,
    late: r.pctLate,
    missing: r.pctMissing,
  };

  return (
    <section className="overflow-hidden rounded-card border border-line bg-paper">
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line px-5 pb-[13px] pt-[15px]">
        <h2 className="text-[15px] font-semibold text-ink">Build readiness</h2>
        <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted">
          BOM × ON-HAND × ON ORDER
        </span>
      </div>

      <div className="px-5 py-4">
        {r.lineCount === 0 ? (
          <p className="text-[12.5px] text-ink-muted">
            No BOM is on file for this unit’s model yet.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-mono text-[26px] font-bold leading-none text-ink">
                {r.pctInHouse}%
              </span>
              <span className="text-[12.5px] text-ink-muted">
                in-house · {r.pctOnOrder}% on order · {r.pctLate}% late ·{" "}
                {r.pctMissing}% short
                <span className="ml-1.5 font-mono text-[11px] text-ink-muted">
                  ({r.lineCount} BOM line{r.lineCount === 1 ? "" : "s"})
                </span>
              </span>
            </div>

            {/* segmented readiness bar */}
            <div className="mt-3 flex h-2.5 overflow-hidden rounded-pill bg-panel">
              {READINESS_SEGMENTS.map((s) =>
                pctByKey[s.key] > 0 ? (
                  <div
                    key={s.key}
                    className={s.swatch}
                    style={{ width: `${pctByKey[s.key]}%`, ...s.style }}
                    title={`${s.label} · ${pctByKey[s.key]}%`}
                  />
                ) : null,
              )}
            </div>

            {/* legend */}
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
              {READINESS_SEGMENTS.map((s) => (
                <span
                  key={s.key}
                  className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted"
                >
                  <span
                    aria-hidden
                    className={`h-2.5 w-2.5 rounded-[3px] ${s.swatch}`}
                    style={s.style}
                  />
                  {s.label}
                  <span className="font-mono text-[10.5px] text-ink">
                    {r.counts[s.key]}
                  </span>
                </span>
              ))}
            </div>

            {/* blocking parts (late ∪ short) */}
            <div className="mt-4 border-t border-line pt-3.5">
              <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted">
                {blocking.length === 0
                  ? "Nothing blocking — every line is covered"
                  : `Blocked on ${blocking.length} part${blocking.length === 1 ? "" : "s"}`}
              </div>
              {blocking.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {blocking.map((b) => (
                    <Link
                      key={b.position}
                      href={b.coveringPo ? "/procurement" : "/inventory"}
                      className="flex items-center gap-2.5 rounded-[9px] border border-line px-3 py-2 transition-colors hover:bg-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <span
                        className={`flex-none rounded-pill px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.04em] ${
                          b.state === "late"
                            ? "bg-ink-strong text-on-dark"
                            : "border border-line-strong bg-panel text-ink-muted"
                        }`}
                      >
                        {b.state === "late" ? "Late" : "Short"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="font-mono text-[12px] font-semibold text-ink">
                          {b.partNumber}
                        </span>
                        <span className="ml-2 text-[11.5px] text-ink-muted">
                          {b.name}
                        </span>
                      </span>
                      <span className="flex-none font-mono text-[10px] text-ink-muted">
                        {b.coveringPo
                          ? b.coveringPo
                          : b.tracked
                            ? `short ${b.shortBy}`
                            : "not tracked"}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function ConfigCell({
  label,
  value,
  note,
  divider = false,
}: {
  label: string;
  value: string;
  note: string;
  divider?: boolean;
}) {
  return (
    <div
      className={`px-5 py-4 ${divider ? "border-b border-line sm:border-b-0 sm:border-r" : ""}`}
    >
      <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted">
        {label}
      </div>
      <div className="mt-1.5 font-mono text-[16px] font-semibold text-ink">
        {value}
      </div>
      <div className="mt-[3px] text-[11.5px] text-ink-muted">{note}</div>
    </div>
  );
}

// ── as-designed vs as-built (expandable summary) ────────────────────────────
function DiffSummary({
  unit,
  subCount,
}: {
  unit: UnitDetail;
  subCount: number;
}) {
  return (
    <details className="dgroup overflow-hidden rounded-card border border-line bg-paper">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3.5 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="dchev h-3.5 w-3.5 flex-none text-ink-muted transition-transform"
          strokeWidth={2.2}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">
            As-designed vs as-built
          </span>
          <span className="mt-0.5 block text-[12.5px] text-ink-muted">
            {unit.diff.summary.positions} positions ·{" "}
            <span className="font-semibold text-ink">
              {subCount} substitution{subCount === 1 ? "" : "s"}
            </span>{" "}
            · {unit.lotsInvolved.length} lot
            {unit.lotsInvolved.length === 1 ? "" : "s"} involved
          </span>
        </span>
        <span className="rounded-pill bg-ink-strong px-2.5 py-[3px] font-mono text-[11px] font-bold text-on-dark">
          {subCount} Δ
        </span>
      </summary>
      <div className="border-t border-line">
        {unit.substitutions.length === 0 ? (
          <p className="px-5 py-4 text-[12.5px] text-ink-muted">
            Every position was built exactly as designed.
          </p>
        ) : (
          unit.substitutions.map((s) => (
            <div
              key={s.position}
              className="grid grid-cols-1 items-center gap-3.5 border-t border-line px-5 py-[13px] first:border-t-0 md:grid-cols-[1fr_24px_1fr_1.1fr]"
            >
              <div className="min-w-0">
                <div className="font-mono text-[9px] uppercase tracking-[0.05em] text-ink-muted">
                  Designed · pos {s.position}
                </div>
                <div className="mt-[3px] font-mono text-[12.5px] text-ink-muted line-through">
                  {s.designed}
                </div>
              </div>
              <span
                aria-hidden
                className="hidden text-center text-ink-muted md:block"
              >
                →
              </span>
              <div className="min-w-0">
                <div className="font-mono text-[9px] uppercase tracking-[0.05em] text-ink-muted">
                  Built
                </div>
                <div className="mt-[3px] font-mono text-[12.5px] font-semibold text-ink">
                  {s.built}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[12px] text-ink">
                  {s.reason ?? "Recorded as a substitution at build."}
                </div>
                <div className="mt-0.5 font-mono text-[10px] text-ink-muted">
                  {fmtDate(s.installedAt)}
                  {s.lotCode ? ` · lot ${s.lotCode}` : ""}
                </div>
              </div>
            </div>
          ))
        )}
        <div className="border-t border-line px-5 py-3">
          <Link
            href={`/units/${encodeURIComponent(unit.serial)}/as-built`}
            className="text-[12.5px] font-semibold text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Open full diff viewer →
          </Link>
        </div>
      </div>
    </details>
  );
}

// ── lifecycle timeline (the hero) ───────────────────────────────────────────
function Lifecycle({ unit }: { unit: UnitDetail }) {
  return (
    <section className="rounded-card border border-line bg-paper px-5 pb-1.5 pt-[18px]">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink">Lifecycle</h2>
        <div className="flex items-center gap-3.5">
          <LegendDot kind="build" label="Build &amp; change" />
          <LegendDot kind="test" label="Test" />
          <LegendDot kind="field" label="Field event" />
        </div>
      </div>
      <p className="mb-[18px] text-[12px] text-ink-muted">
        Every event carries the configuration this unit was running at that
        time.
      </p>

      {unit.timeline.length === 0 ? (
        <p className="pb-5 text-[12.5px] text-ink-muted">
          No lifecycle events recorded for this unit yet.
        </p>
      ) : (
        /* The spine sits on the WRAPPER, not inside the <ol> — a list may only
           contain <li> children (WCAG 1.3.1). */
        <div className="relative pl-[22px]">
          <span
            aria-hidden
            className="absolute bottom-5 left-[5px] top-1 w-0.5 bg-line-strong"
          />
          <ol>
            {unit.timeline.map((e, i) => (
              <li
                key={`${e.ts.toISOString()}-${i}`}
                className="relative -ml-3 flex gap-4 rounded-[9px] py-[11px] pl-3 pr-3"
              >
                <span
                  aria-hidden
                  className={`absolute left-0 top-[15px] h-3 w-3 border-2 border-paper ${dotShape(e.kind)} ${dotColor(e.kind)}`}
                />
                <span className="w-[74px] flex-none pt-px font-mono text-[10.5px] text-ink-muted">
                  {fmtDate(e.ts)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold text-ink">
                    {e.title}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] leading-[1.45] text-ink-muted">
                    {e.detail}
                  </span>
                </span>
                {/* the config THIS unit was running at THIS timestamp */}
                <span
                  title={
                    e.swAt
                      ? `Running ${e.swAt} at this point`
                      : "No software state recorded at this point"
                  }
                  className="mt-px h-fit flex-none rounded-[5px] border border-line-panel bg-panel px-2 py-[3px] font-mono text-[9.5px] tracking-[0.03em] text-ink-muted"
                >
                  {e.configAt ?? e.swAt ?? "—"}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function dotColor(kind: TimelineKind): string {
  return kind === "test" ? "bg-accent" : "bg-ink-strong";
}
function dotShape(kind: TimelineKind): string {
  // A field event is a square; everything else is a dot (the design's legend).
  return kind === "field" ? "rounded-[2px]" : "rounded-full";
}

function LegendDot({ kind, label }: { kind: TimelineKind; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
      <span
        aria-hidden
        className={`h-2 w-2 ${dotShape(kind)} ${dotColor(kind)}`}
      />
      {label}
    </span>
  );
}

// ── small shared pieces ─────────────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const live = status === "deployed" || status === "active";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-[3px] text-[11px] font-semibold tracking-[0.03em] ${
        live
          ? "bg-success-tint text-success"
          : "border border-line-strong bg-panel text-ink"
      }`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${live ? "bg-success" : "bg-ink-strong"}`}
      />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function Sep() {
  return (
    <span aria-hidden className="text-line-strong">
      ·
    </span>
  );
}

function RailSection({
  label,
  right,
  children,
}: {
  label: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted">
          {label}
        </h2>
        {right}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function RailEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[10px] border border-dashed border-line-strong px-3 py-3 text-[11.5px] leading-[1.45] text-ink-muted">
      {children}
    </p>
  );
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toISOString().slice(0, 10);
}
