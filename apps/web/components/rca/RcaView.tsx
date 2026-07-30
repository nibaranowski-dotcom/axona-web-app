"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lightbulb, Check, Radius } from "lucide-react";
import type { RcaWorkspace } from "@/lib/rca";
import { ROOT_CAUSES } from "@/lib/quality";
import { setNcrRootCauseAction } from "@/app/(shell)/quality/actions";
import { ConnectedObjects } from "@/components/ontology/ConnectedObjects";
import type { ConnectedGroup } from "@/lib/connected-objects";

// PLM.8 — the RCA workspace (`RCA.dc.html` 1:1 on DS.1 primitives). Evidence is
// assembled by the system; the AGENT PROPOSES a candidate cause with calibrated
// confidence (CONF.1); the HUMAN classifies (Confirm) — the agent never
// auto-classifies. Fully usable with the suggestion hidden. DETAIL screen →
// breadcrumbs. Classification reuses PLM.V2's RBAC-gated + audited action.

const LABEL: Record<string, string> = {
  software: "Software",
  hardware: "Hardware",
  design: "Design",
  production: "Production",
  component: "Component",
  field_modification: "Field mod",
};

export function RcaView({
  rca,
  canClassify,
  connected,
}: {
  rca: RcaWorkspace;
  canClassify: boolean;
  connected: ConnectedGroup[];
}) {
  const router = useRouter();
  const [choice, setChoice] = useState(rca.rootCause ?? "");
  const [saved, setSaved] = useState<string | null>(rca.rootCause);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    if (!choice) return;
    setError(null);
    startTransition(async () => {
      try {
        await setNcrRootCauseAction(rca.ncrCode, choice);
        setSaved(choice);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Classification failed.");
      }
    });
  };

  return (
    <div className="flex min-h-full flex-col bg-panel">
      <header className="flex-none border-b border-line bg-paper px-6 pb-4 pt-3.5">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.05em] text-ink-faint">
            <li>
              <Link href="/quality" className="hover:text-ink">
                Quality
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li className="text-ink-muted">{rca.ncrCode}</li>
            <li aria-hidden>/</li>
            <li className="text-ink-muted">Investigation</li>
          </ol>
        </nav>
        <div className="mt-2.5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold tracking-[-0.03em] text-ink">
              {rca.defect}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
              <span className="font-mono text-[12px]">{rca.ncrCode}</span>
              {rca.serial && rca.unitHref && (
                <>
                  <Sep />
                  <Link
                    href={rca.unitHref}
                    className="font-mono text-[12px] text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink-strong"
                  >
                    {rca.serial}
                  </Link>
                </>
              )}
              {rca.configAtFailure && (
                <>
                  <Sep />
                  <span>
                    config at failure{" "}
                    <span className="font-mono text-[12px] text-ink">
                      {rca.configAtFailure}
                    </span>
                  </span>
                </>
              )}
              {rca.testRunCode && rca.testRunHref && (
                <>
                  <Sep />
                  <Link
                    href={rca.testRunHref}
                    className="font-mono text-[12px] text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink-strong"
                  >
                    {rca.testRunCode}
                  </Link>
                </>
              )}
            </div>
          </div>
          <span className="inline-flex flex-none items-center gap-1.5 rounded-pill bg-ink-strong px-[11px] py-1 text-[11px] font-bold tracking-[0.03em] text-on-dark">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-on-dark" />
            {saved ? "Classified" : "Investigating"}
          </span>
        </div>
      </header>

      <div className="flex-1 px-6 pb-16 pt-5">
        {/* symptom */}
        <div className="mb-[18px] flex flex-wrap items-center gap-4 rounded-card bg-ink-strong px-5 py-4">
          <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-on-dark-mut">
            Symptom
          </span>
          <span className="min-w-[220px] flex-1 text-[14px] font-medium text-on-dark">
            {rca.symptom}
          </span>
        </div>

        {/* evidence */}
        <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.06em] text-ink-faint">
          Evidence assembled by the system
        </div>
        <div className="mb-[22px] grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          {rca.evidence.map((c) => (
            <div
              key={c.key}
              className="flex flex-col overflow-hidden rounded-[13px] border border-line bg-paper"
            >
              <div className="border-b border-line px-[15px] pb-2.5 pt-3.5">
                <div className="text-[13px] font-semibold text-ink">
                  {c.title}
                </div>
                <div className="mt-1.5 text-[11.5px] leading-[1.4] text-ink-muted">
                  {c.summary}
                </div>
              </div>
              <div className="flex-1">
                {c.items.map((i, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 border-t border-line px-[15px] py-2.5 first:border-t-0"
                  >
                    <span
                      aria-hidden
                      className="mt-1.5 h-[5px] w-[5px] flex-none rounded-full bg-line-strong"
                    />
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] font-semibold text-ink">
                        {i.k}
                      </div>
                      <div className="mt-px text-[11px] leading-[1.35] text-ink-muted">
                        {i.v}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* classifier + disposition */}
        <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-card border border-line bg-paper px-5 py-[18px]">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-ink">
                Root-cause classification
              </h2>
              <span className="rounded-[5px] border border-line-panel bg-panel px-[7px] py-0.5 font-mono text-[9.5px] uppercase tracking-[0.04em] text-ink-muted">
                You classify
              </span>
            </div>

            {/* the agent's proposal — assistance only, never auto-applied */}
            {rca.suggestion && (
              <div className="my-3.5 flex items-center gap-2.5 rounded-[9px] border border-line bg-panel-2 px-3 py-2.5">
                <Lightbulb
                  className="h-[15px] w-[15px] flex-none text-ink-muted"
                  strokeWidth={1.7}
                  aria-hidden
                />
                <span className="text-[12px] text-ink">
                  <span className="font-semibold">Agent suggests:</span>{" "}
                  {LABEL[rca.suggestion.cause] ?? rca.suggestion.cause} —{" "}
                  {rca.suggestion.rationale}{" "}
                  <span className="font-mono text-ink-muted">
                    confidence {rca.suggestion.calibrated.toFixed(2)}
                    {rca.suggestion.calibratedState === "uncalibrated"
                      ? " (uncal)"
                      : rca.suggestion.calibrated !==
                          rca.suggestion.rawConfidence
                        ? ` · raw ${rca.suggestion.rawConfidence.toFixed(2)}`
                        : ""}
                  </span>
                </span>
              </div>
            )}

            <fieldset disabled={!canClassify} className="mt-3">
              <legend className="sr-only">Root cause for {rca.ncrCode}</legend>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {ROOT_CAUSES.map((c) => {
                  const active = choice === c;
                  return (
                    <label
                      key={c}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-[9px] border px-3 py-2.5 transition-colors ${
                        active
                          ? "border-ink-strong bg-panel"
                          : "border-line hover:border-ink-strong"
                      } ${!canClassify ? "cursor-not-allowed opacity-60" : ""}`}
                    >
                      <input
                        type="radio"
                        name="rootcause"
                        value={c}
                        checked={active}
                        onChange={() => setChoice(c)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden
                        className={`inline-flex h-[15px] w-[15px] flex-none items-center justify-center rounded-full border-[1.5px] ${active ? "border-ink-strong" : "border-line-strong"}`}
                      >
                        {active && (
                          <span className="h-2 w-2 rounded-full bg-ink-strong" />
                        )}
                      </span>
                      <span
                        className={`text-[12.5px] ${active ? "font-semibold text-ink" : "text-ink-muted"}`}
                      >
                        {LABEL[c] ?? c}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {canClassify ? (
                <button
                  type="button"
                  onClick={confirm}
                  disabled={!choice || pending}
                  className="inline-flex items-center gap-2 rounded-btn bg-ink-strong px-4 py-2.5 text-[13px] font-semibold text-on-dark transition-colors hover:bg-black disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Check
                    className="h-3.5 w-3.5"
                    strokeWidth={2.2}
                    aria-hidden
                  />
                  {pending ? "Saving…" : "Confirm classification"}
                </button>
              ) : (
                <span className="text-[12px] text-ink-muted">
                  You do not have permission to classify this NCR.
                </span>
              )}
              {saved && (
                <span role="status" className="text-[12px] text-ink-muted">
                  Classified as{" "}
                  <span className="font-semibold text-ink">
                    {LABEL[saved] ?? saved}
                  </span>{" "}
                  · audited
                </span>
              )}
              {error && (
                <span role="alert" className="text-[12px] text-ink">
                  {error}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col rounded-card border border-line bg-paper px-5 py-[18px]">
            <h2 className="text-[15px] font-semibold text-ink">Disposition</h2>
            <p className="mt-2 text-[12px] leading-[1.45] text-ink-muted">
              Once the cause is confirmed, hand the affected units to field
              service via the blast radius — every unit on the same lot, with
              the relation path that reached it.
            </p>
            <Link
              href={rca.blastHref}
              className="mt-auto inline-flex items-center justify-center gap-2 rounded-btn border border-line-strong px-4 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:border-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Radius className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
              See affected units → blast radius
            </Link>
          </div>
        </div>

        {/* LINK.1 — directly connected records (1-hop); blast radius owns N-hop. */}
        <ConnectedObjects groups={connected} className="mt-[18px]" />
      </div>
    </div>
  );
}

function Sep() {
  return (
    <span aria-hidden className="text-line-strong">
      ·
    </span>
  );
}
