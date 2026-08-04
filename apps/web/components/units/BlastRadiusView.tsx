"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Boxes, FileText } from "lucide-react";
import {
  TRACE_LABEL,
  type BlastRadiusView as ViewData,
  type TraceType,
} from "@/lib/blast-radius-shared";
import { handToFieldServiceAction } from "@/app/(shell)/blast-radius/actions";
import { reviewBlastRadiusAction } from "@/app/(shell)/blast-radius/agent-actions";
import { AgentProposalPanel } from "@/components/agents/AgentProposalPanel";

// PLM.5 — the blast radius (`Blast Radius.dc.html` 1:1 on the DS.1 primitives).
// The ONT.1 traversal already ships; this is its UI. Results are grouped by
// module and EVERY row shows the relation path that reached it — the screen's
// whole credibility rests on being able to say *how* it got there.
//
// Unit rows link to /units/:serial (the Unit page). That is the point: since
// PLM.2 a UNIT node in the graph IS the Unit spine, so this is a direct link,
// not a per-screen bridge over a build record.

const TYPES: TraceType[] = ["lot", "sw", "eco", "part"];

export function BlastRadiusView({
  data,
  canHandOff,
}: {
  data: ViewData;
  canHandOff: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const go = (type: TraceType, value?: string) => {
    const v = value ?? data.options[type][0]?.value ?? "";
    startTransition(() =>
      router.push(
        `${pathname}?type=${type}${v ? `&value=${encodeURIComponent(v)}` : ""}`,
      ),
    );
  };

  return (
    <div className="flex min-h-full flex-col bg-panel">
      <header className="sticky top-0 z-20 flex h-[60px] flex-none items-center justify-between border-b border-line bg-paper px-6">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
            Engineering · PLM · traceability
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
            Blast radius
          </h1>
        </div>
        <HandOff
          serials={data.handoffSerials}
          root={data.rootLabel}
          canHandOff={canHandOff}
        />
      </header>

      {/* input selector */}
      <div className="flex flex-none flex-wrap items-center gap-3.5 border-b border-line bg-paper px-6 py-3.5">
        <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted">
          Trace from
        </span>
        <div
          role="group"
          aria-label="What to trace from"
          className="flex rounded-[9px] border border-line-strong bg-panel p-[3px]"
        >
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={data.type === t}
              onClick={() => go(t)}
              className={`rounded-[6px] px-[13px] py-1.5 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                data.type === t
                  ? "bg-ink-strong text-on-dark"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {TRACE_LABEL[t]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-[9px] rounded-[9px] border border-ink-strong bg-panel px-3 py-1.5">
          <Boxes
            className="h-3.5 w-3.5 flex-none text-ink-muted"
            strokeWidth={1.9}
            aria-hidden
          />
          <label htmlFor="trace-root" className="sr-only">
            {TRACE_LABEL[data.type]} to trace from
          </label>
          <select
            id="trace-root"
            value={data.value ?? ""}
            onChange={(e) => go(data.type, e.target.value)}
            className="border-none bg-transparent py-1 font-mono text-[13px] font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {data.options[data.type].length === 0 && (
              <option value="">none available</option>
            )}
            {data.options[data.type].map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {data.rootHint && (
            <span className="text-[11.5px] text-ink-muted">
              · {data.rootHint}
            </span>
          )}
        </div>
      </div>

      {/* impact summary — the one dark strip on this screen */}
      <div className="flex flex-none flex-wrap bg-ink-strong text-on-dark">
        <DarkStat v={data.summary.units} l="Units affected" />
        <DarkStat v={data.summary.sites} l="Sites" divider />
        <DarkStat v={data.summary.customers} l="Customers" divider />
        <DarkStat v={data.rootLabel} l="Trace root" divider accent />
      </div>

      <div className="min-w-0 flex-1 px-6 pb-6 pt-5">
        {/* DEMO.6 #5 — the agent that COMPUTED this set. The traversal was always
            real; what was missing was any sign something did it, and any statement of
            how well corroborated the answer is. Only shown for an ECO root, because
            that is the one whose set a human is asked to confirm and hand off. */}
        {data.agent && data.type === "eco" && data.value && (
          <AgentProposalPanel
            title="Blast-radius agent"
            proposal={data.agent}
            confirmLabel="Confirm affected set"
            className="mb-[18px]"
            onDecide={async (upheld) => {
              const r = await reviewBlastRadiusAction(data.value!, upheld);
              return r.loopWriteback;
            }}
          />
        )}
        {!data.found ? (
          <div className="rounded-card border border-line bg-paper px-6 py-14 text-center">
            <p className="text-[13.5px] font-semibold text-ink">
              {data.message ?? "Nothing traces from here."}
            </p>
            <p className="mx-auto mt-1.5 max-w-[52ch] text-[12.5px] leading-[1.5] text-ink-muted">
              The graph only reports links that were actually recorded — nothing
              is inferred. Pick another root above.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-4 text-[12.5px] text-ink-muted">
              Everything the graph reaches from{" "}
              <span className="font-mono text-[11.5px] text-ink">
                {data.rootLabel}
              </span>
              , grouped by module — each row shows the relation path that
              connected it.
            </p>
            <div className="flex flex-col gap-3">
              {data.groups.map((g, i) => (
                <details
                  key={g.module}
                  open={i < 2}
                  className="dgroup overflow-hidden rounded-[13px] border border-line bg-paper"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-[18px] py-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
                    <ChevronRight
                      className="dchev h-[13px] w-[13px] flex-none text-ink-muted transition-transform"
                      strokeWidth={2.2}
                      aria-hidden
                    />
                    <span
                      aria-hidden
                      className="h-[9px] w-[9px] flex-none rounded-[2px] bg-ink-strong"
                    />
                    <span className="flex-1 text-[14px] font-semibold text-ink">
                      {g.module}
                    </span>
                    <span className="text-[12px] text-ink-muted">
                      {g.summary}
                    </span>
                    <span className="rounded-pill border border-line-panel bg-panel px-2.5 py-0.5 font-mono text-[11px] font-bold text-ink">
                      {g.count}
                    </span>
                  </summary>
                  <div className="border-t border-line">
                    {g.rows.map((r) => (
                      <Link
                        key={`${g.module}-${r.code}`}
                        href={r.href}
                        className="grid grid-cols-[1.1fr_2.3fr_0.9fr] items-center gap-3.5 border-t border-line py-3 pl-10 pr-[18px] text-ink transition-colors first:border-t-0 hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                      >
                        <span className="font-mono text-[12.5px] font-semibold">
                          {r.code}
                        </span>
                        <span
                          title={r.path}
                          className="min-w-0 truncate font-mono text-[10.5px] text-ink-muted"
                        >
                          {r.path}
                        </span>
                        <span className="justify-self-end">
                          <StatusTag status={r.status} />
                        </span>
                      </Link>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Live/healthy reads green; everything else is ink or panel. No invented reds —
// a critical state is INK (brand invariant).
function StatusTag({ status }: { status: string }) {
  const s = status.toLowerCase();
  const live = /deployed|active|released|in stock|in control|done/.test(s);
  const hot = /open|critical|quarantin|hold|out of spec|fault/.test(s);
  return (
    <span
      className={`rounded-pill px-2.5 py-[3px] text-[10.5px] font-semibold ${
        hot
          ? "bg-ink-strong text-on-dark"
          : live
            ? "bg-success-tint text-success"
            : "border border-line-panel bg-panel text-ink-muted"
      }`}
    >
      {status}
    </span>
  );
}

function DarkStat({
  v,
  l,
  divider = false,
  accent = false,
}: {
  v: string | number;
  l: string;
  divider?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={`min-w-[150px] flex-1 px-6 py-4 ${divider ? "border-l border-on-dark-faint" : ""}`}
    >
      <div
        className={`font-mono text-[22px] font-bold tracking-[-0.02em] ${accent ? "text-accent" : "text-on-dark"}`}
      >
        {v}
      </div>
      <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.05em] text-on-dark-mut">
        {l}
      </div>
    </div>
  );
}

// The hand-off is a real, consequential write (it dispatches field work), so it
// is role-gated and audited — and it always states exactly what it will do to
// how many units before you commit. Never automatic.
function HandOff({
  serials,
  root,
  canHandOff,
}: {
  serials: string[];
  root: string;
  canHandOff: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canHandOff || serials.length === 0) return null;

  const run = () => {
    setError(null);
    startTransition(async () => {
      try {
        const n = await handToFieldServiceAction(serials, root);
        setDone(n);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Hand-off failed.");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setDone(null);
          setError(null);
        }}
        className="inline-flex items-center gap-2 rounded-btn border border-ink-strong bg-ink-strong px-[15px] py-[9px] text-[13px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <FileText className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
        Hand to field service
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="handoff-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-strong/30 p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-[520px] rounded-card border border-line bg-paper p-6">
            <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted">
              Blast radius · {root}
            </div>
            <h2
              id="handoff-title"
              className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-ink"
            >
              Hand {serials.length} deployed unit
              {serials.length === 1 ? "" : "s"} to field service
            </h2>
            <p className="mt-2.5 text-[12.5px] leading-[1.55] text-ink-muted">
              This raises one field work order per unit, referencing{" "}
              <span className="font-mono text-[11.5px] text-ink">{root}</span>.
              Units still in build are not included — only what is actually in
              the field.
            </p>
            <p className="mt-3 max-h-[120px] overflow-y-auto rounded-[9px] border border-line bg-panel p-3 font-mono text-[11.5px] leading-[1.6] text-ink">
              {serials.join(" · ")}
            </p>

            {error && (
              <p
                role="alert"
                className="mt-3 rounded-[9px] border border-line-strong bg-panel px-3 py-2.5 text-[12.5px] text-ink"
              >
                {error}
              </p>
            )}
            {done !== null && (
              <p
                role="status"
                className="mt-3 rounded-[9px] border border-line bg-panel px-3 py-2.5 text-[12.5px] text-ink"
              >
                {done} work order{done === 1 ? "" : "s"} raised and audited.
              </p>
            )}

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-btn border border-line-strong px-4 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:border-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {done === null ? "Cancel" : "Close"}
              </button>
              {done === null && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={run}
                  className="rounded-btn border border-ink-strong bg-ink-strong px-4 py-2 text-[12.5px] font-semibold text-on-dark transition-colors hover:bg-black disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {pending ? "Raising…" : `Raise ${serials.length}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
