import Link from "next/link";
import { Lock, TriangleAlert } from "lucide-react";
import type { TestRunDetail } from "@/lib/tests-types";
import { ConnectedObjects } from "@/components/ontology/ConnectedObjects";
import type { ConnectedGroup } from "@/lib/connected-objects";
import { RecordHistory } from "@/components/audit/RecordHistory";
import type { AuditEntry } from "@/lib/audit-trail";

// PLM.7 — the Test Run (`Test Run.dc.html` 1:1 on DS.1 primitives). The FROZEN
// configuration snapshot is the signature artifact: it is rendered verbatim from
// TestRun.configSnapshot (immutable, at run time) — changing the unit's CURRENT
// config never alters this page. DETAIL screen → full breadcrumbs.
//
// The "Open failure investigation" link points at Quality (the NCR list) for now —
// the dedicated RCA workspace is PLM.8. Flagged: the design links to RCA.dc.html.

function fmtDateTime(at: Date): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function limitLabel(lower: number | null, upper: number | null): string {
  if (lower != null && upper != null) return `${lower}–${upper}`;
  if (upper != null) return `< ${upper}`;
  if (lower != null) return `> ${lower}`;
  return "—";
}

export function TestRunView({
  run,
  connected,
  history,
}: {
  run: TestRunDetail;
  connected: ConnectedGroup[];
  history: AuditEntry[];
}) {
  const failed = run.outcome === "fail";
  const snap = run.snapshot;

  return (
    <div className="flex min-h-full flex-col bg-panel">
      <header className="sticky top-0 z-20 flex h-[60px] flex-none items-center border-b border-line bg-paper px-6">
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex items-center gap-2 font-mono text-[12px]">
            <li>
              <Link href="/quality" className="text-ink-faint hover:text-ink">
                Quality
              </Link>
            </li>
            <li aria-hidden className="text-line-strong">
              /
            </li>
            <li>
              <Link href="/tests" className="text-ink-faint hover:text-ink">
                Test explorer
              </Link>
            </li>
            <li aria-hidden className="text-line-strong">
              /
            </li>
            <li className="min-w-0 truncate text-ink-muted">{run.code}</li>
          </ol>
        </nav>
      </header>

      <div className="flex-1 px-6 pb-16 pt-5">
        {/* title row */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="font-mono text-[22px] font-bold tracking-[-0.03em] text-ink">
                {run.code}
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-pill px-[11px] py-[3px] text-[11px] font-bold tracking-[0.03em] ${
                  failed
                    ? "bg-ink-strong text-on-dark"
                    : "bg-success-tint text-success"
                }`}
              >
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 rounded-full ${failed ? "bg-on-dark" : "bg-success"}`}
                />
                {run.outcome.toUpperCase()}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
              <span>
                {run.procedure} · {run.procedureCode}
              </span>
              <span aria-hidden className="text-line-strong">
                ·
              </span>
              <Link
                href={run.unitHref}
                className="font-mono text-[12px] text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink-strong"
              >
                {run.serial}
              </Link>
              <span aria-hidden className="text-line-strong">
                ·
              </span>
              <span className="font-mono text-[12px]">
                {fmtDateTime(run.startedAt)}
              </span>
            </div>
          </div>
          {run.ncr && (
            <Link
              href="/quality"
              className="inline-flex items-center gap-2 rounded-btn bg-ink-strong px-[15px] py-[9px] text-[13px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Open failure investigation →
            </Link>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-[18px] lg:grid-cols-[1fr_322px]">
          {/* main column */}
          <div className="flex min-w-0 flex-col gap-[18px]">
            {/* meta strip */}
            <div className="flex flex-wrap overflow-hidden rounded-card border border-line bg-paper">
              <Meta l="Procedure" v={run.procedureCode} />
              <Meta l="Operator" v={run.operatorLabel ?? "—"} divider />
              <Meta l="Unit" v={run.serial} divider />
              <Meta l="Steps" v={`${run.steps.length}`} divider />
            </div>

            {/* step results */}
            <section className="overflow-hidden rounded-card border border-line bg-paper">
              <div className="flex items-center justify-between px-5 pb-3 pt-4">
                <h3 className="text-[15px] font-semibold text-ink">
                  Step results
                </h3>
                <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-faint">
                  {run.steps.length} steps · {run.stepFailCount} fail
                </span>
              </div>
              <div className="grid grid-cols-[2fr_1.1fr_1.1fr_0.8fr] gap-3 border-t border-line px-5 py-[9px] font-mono text-[9px] uppercase tracking-[0.06em] text-ink-faint">
                <span>Step</span>
                <span>Measurement</span>
                <span>Limits</span>
                <span>Result</span>
              </div>
              {run.steps.length === 0 ? (
                <p className="border-t border-line px-5 py-6 text-sm text-ink-muted">
                  No recorded steps.
                </p>
              ) : (
                run.steps.map((s) => (
                  <div
                    key={s.step}
                    className={`grid grid-cols-[2fr_1.1fr_1.1fr_0.8fr] items-center gap-3 border-t border-line px-5 py-3 ${s.passed ? "" : "bg-panel-2"}`}
                  >
                    <span className="text-[13px] text-ink">{s.step}</span>
                    <span
                      className={`font-mono text-[12px] font-semibold ${s.passed ? "text-success" : "text-ink-strong"}`}
                    >
                      {s.measurement != null
                        ? `${s.measurement}${s.unitOfMeasure ? ` ${s.unitOfMeasure}` : ""}`
                        : "—"}
                    </span>
                    <span className="font-mono text-[11px] text-ink-muted">
                      {limitLabel(s.lowerLimit, s.upperLimit)}
                    </span>
                    <span
                      className={`font-mono text-[10.5px] font-bold ${s.passed ? "text-success" : "text-ink-strong"}`}
                    >
                      {s.passed ? "PASS" : "FAIL"}
                    </span>
                  </div>
                ))
              )}
            </section>

            {/* linked failure */}
            {run.ncr && (
              <Link
                href="/quality"
                className="flex items-center gap-3.5 rounded-card border border-ink-strong bg-paper px-[18px] py-[15px] transition-colors hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span
                  aria-hidden
                  className="inline-flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] bg-panel-2 text-ink-strong"
                >
                  <TriangleAlert
                    className="h-[17px] w-[17px]"
                    strokeWidth={1.8}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-ink">
                    {run.ncr.code} · {run.ncr.defect}
                  </div>
                  <div className="mt-0.5 text-[12px] text-ink-muted">
                    This run triggered the non-conformance
                    {run.ncr.rootCause
                      ? ` · root cause: ${run.ncr.rootCause}`
                      : " · investigation in progress"}
                  </div>
                </div>
                <span className="flex-none font-mono text-[11px] font-semibold text-ink">
                  Open →
                </span>
              </Link>
            )}
          </div>

          {/* frozen config snapshot (signature) */}
          <aside className="flex flex-col gap-4 rounded-card border border-line bg-paper p-5">
            <div className="flex items-center gap-2.5">
              <Lock
                className="h-[15px] w-[15px] flex-none text-ink-muted"
                strokeWidth={1.9}
                aria-hidden
              />
              <div>
                <div className="text-[13.5px] font-semibold text-ink">
                  Frozen configuration
                </div>
                <div className="font-mono text-[9px] uppercase tracking-[0.04em] text-ink-faint">
                  immutable · at run time
                </div>
              </div>
            </div>
            <p className="text-[12px] leading-[1.45] text-ink-muted">
              This result is inseparable from the exact configuration the unit
              was running when the test ran.
            </p>

            {snap ? (
              <div className="overflow-hidden rounded-[12px] border border-line">
                <SnapRow
                  k="Config version"
                  v={snap.configVersion?.name ?? "—"}
                  first
                />
                <SnapRow k="Software" v={snap.sw?.version ?? "—"} />
                {snap.hw.slice(0, 6).map((h) => (
                  <SnapRow
                    key={h.position}
                    k={h.position}
                    v={`${h.partNumber} ${h.rev}${h.lotCode ? ` · lot ${h.lotCode}` : ""}`}
                  />
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-ink-muted">
                No frozen snapshot recorded for this run.
              </p>
            )}

            {run.environment && Object.keys(run.environment).length > 0 && (
              <div className="rounded-[12px] border border-line p-3.5">
                <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.05em] text-ink-faint">
                  Conditions
                </div>
                {Object.entries(run.environment).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between gap-2 py-[5px] text-[12px]"
                  >
                    <span className="text-ink-muted">{k}</span>
                    <span className="font-mono text-[11.5px] text-ink">
                      {String(v)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <Link
              href={run.asBuiltHref}
              className="text-[12px] font-semibold text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Compare to as-designed →
            </Link>
          </aside>
        </div>

        {/* LINK.1 — directly connected records (1-hop); blast radius owns N-hop. */}
        <ConnectedObjects groups={connected} className="mt-[18px]" />

        {/* HIST.1 — this test run's audited change history (AUDIT.1). */}
        <RecordHistory entries={history} className="mt-[18px]" />
      </div>
    </div>
  );
}

function Meta({
  l,
  v,
  divider = false,
}: {
  l: string;
  v: string;
  divider?: boolean;
}) {
  return (
    <div
      className={`min-w-[130px] flex-1 px-[18px] py-3.5 ${divider ? "border-l border-line" : ""}`}
    >
      <div className="font-mono text-[9px] uppercase tracking-[0.05em] text-ink-faint">
        {l}
      </div>
      <div className="mt-1 font-mono text-[14px] font-semibold text-ink">
        {v}
      </div>
    </div>
  );
}

function SnapRow({
  k,
  v,
  first = false,
}: {
  k: string;
  v: string;
  first?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2.5 bg-panel px-3.5 py-[11px] ${first ? "" : "border-t border-line"}`}
    >
      <span className="font-mono text-[9.5px] uppercase tracking-[0.04em] text-ink-faint">
        {k}
      </span>
      <span className="text-right font-mono text-[11.5px] font-semibold text-ink">
        {v}
      </span>
    </div>
  );
}
