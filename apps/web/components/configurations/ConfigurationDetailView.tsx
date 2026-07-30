"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Copy, Frame, ChevronDown } from "lucide-react";
import type { ConfigDetail, ConfigState } from "@/lib/configurations";
import { ConnectedObjects } from "@/components/ontology/ConnectedObjects";
import type { ConnectedGroup } from "@/lib/connected-objects";
import {
  lockConfigAction,
  unlockConfigAction,
} from "@/app/(shell)/configurations/[code]/actions";

// PLM.11 — the Configuration detail (`Configuration.dc.html` 1:1 on DS.1 primitives).
// Resolved HW+SW manifest (frozen for a baseline · live for a draft), baseline state +
// DUAL-APPROVER lock/unlock via decide(), matching-units → registry, version diff (as-
// built alignment), change history. v2 tokens · no emoji · no invented reds (superseded
// + capped states use ink, baseline uses functional green).

const STATE_PILL: Record<
  ConfigState,
  { label: string; cls: string; lock: boolean }
> = {
  baseline: {
    label: "Baseline · locked",
    cls: "bg-success-tint text-success",
    lock: true,
  },
  draft: {
    label: "Draft",
    cls: "border border-line-strong bg-panel text-ink",
    lock: false,
  },
  superseded: {
    label: "Superseded",
    cls: "border border-line-strong bg-panel text-ink-muted",
    lock: false,
  },
};

export function ConfigurationDetailView({
  data,
  canLock,
  connected,
}: {
  data: ConfigDetail;
  canLock: boolean;
  connected: ConnectedGroup[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [agentDismissed, setAgentDismissed] = useState(false);
  const [pending, startTransition] = useTransition();

  const pill = STATE_PILL[data.state];

  const run = (fn: () => Promise<{ status: string; summary: string }>) => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const res = await fn();
        setNotice(res.summary);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed.");
      }
    });
  };

  const changedCount =
    (data.diff?.hw.filter((r) => r.differs).length ?? 0) +
    (data.diff?.sw.filter((r) => r.differs).length ?? 0);
  const hwChanged = data.diff?.hw.filter((r) => r.differs).length ?? 0;
  const swChanged = data.diff?.sw.filter((r) => r.differs).length ?? 0;

  return (
    <div className="flex min-h-full flex-col bg-panel">
      {/* identity header */}
      <header className="flex-none border-b border-line bg-paper px-6 pb-4 pt-3.5">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.05em] text-ink-faint">
            <li>
              <Link href="/engineering" className="hover:text-ink">
                Engineering
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href="/configurations" className="hover:text-ink">
                Configurations
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li className="text-ink-muted">{data.code}</li>
          </ol>
        </nav>

        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-[24px] font-bold tracking-[-0.02em] text-ink">
                {data.code}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11px] font-semibold tracking-[0.03em] ${pill.cls}`}
              >
                {pill.lock && <Lock size={12} strokeWidth={2.2} />}
                {pill.label}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-[13px] text-ink-muted">
              <span>{data.model}</span>
              {data.baselinedAt && (
                <>
                  <span className="text-line-strong">·</span>
                  <span className="font-mono text-[12px]">
                    Baselined {data.baselinedAt}
                  </span>
                </>
              )}
              <span className="text-line-strong">·</span>
              <span className="font-mono text-[12px]">
                {data.manifest.hwCount} HW · {data.manifest.sw.length} SW
              </span>
            </div>
          </div>

          <div className="flex flex-none items-center gap-2.5">
            <Link
              href="/configurations"
              className="inline-flex items-center gap-2 rounded-lg border border-line-strong px-3.5 py-2 text-[13px] font-semibold text-ink hover:border-ink-strong"
            >
              <Copy size={14} strokeWidth={1.8} />
              Duplicate as draft
            </Link>
            {data.state === "draft" && canLock && (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => lockConfigAction(data.id))}
                className="rounded-lg border border-ink-strong bg-ink-strong px-3.5 py-2 text-[13px] font-semibold text-paper disabled:opacity-60"
              >
                {data.lockAwaitingSecond
                  ? "Approve lock (2nd)"
                  : "Lock / baseline"}
              </button>
            )}
            {data.state === "baseline" && canLock && (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => unlockConfigAction(data.id))}
                className="rounded-lg border border-ink-strong bg-ink-strong px-3.5 py-2 text-[13px] font-semibold text-paper disabled:opacity-60"
              >
                Request unlock
              </button>
            )}
          </div>
        </div>

        {/* lineage */}
        {data.lineage.length > 1 && (
          <div className="mt-3.5 flex flex-wrap items-center gap-2.5 border-t border-line pt-3">
            <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-faint">
              Lineage
            </span>
            {data.lineage.map((n, i) => (
              <span key={n.name} className="flex items-center gap-2.5">
                {i > 0 && (
                  <span className="text-[12px] text-line-strong">→</span>
                )}
                {n.current ? (
                  <span className="rounded-md bg-ink-strong px-2.5 py-1 font-mono text-[11.5px] font-semibold text-paper">
                    {n.name}
                  </span>
                ) : (
                  <Link
                    href={n.href}
                    className="rounded-md border border-line-panel bg-panel px-2.5 py-1 font-mono text-[11.5px] text-ink-muted hover:border-ink-strong"
                  >
                    {n.name}
                    {n.state === "draft" ? " · draft" : ""}
                  </Link>
                )}
              </span>
            ))}
            {data.supersedesNote && (
              <span className="ml-1 text-[12px] text-ink-faint">
                {data.supersedesNote}
              </span>
            )}
          </div>
        )}

        {(error || notice) && (
          <p
            role="status"
            className={`mt-3 font-mono text-[11px] ${error ? "text-ink" : "text-ink-muted"}`}
          >
            {error ?? notice}
          </p>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        {/* main column */}
        <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
          {/* MANIFEST — the signature artifact */}
          <section className="overflow-hidden rounded-card border border-line bg-paper">
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line px-5 py-3.5">
              <div>
                <h2 className="text-[15px] font-semibold text-ink">
                  Resolved configuration
                </h2>
                <p className="mt-0.5 text-[12px] text-ink-muted">
                  Everything a unit on this configuration is built and running.
                </p>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-faint">
                {data.frozen ? "Immutable · baseline" : "Live · draft"}
              </span>
            </div>

            {/* hardware */}
            <div className="flex items-center gap-2.5 px-5 pb-1 pt-3.5">
              <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-faint">
                Hardware · {data.manifest.hwCount} positions
              </span>
              <span className="h-px flex-1 bg-line" />
              <span className="font-mono text-[10px] text-ink-faint">
                {data.model}
              </span>
            </div>
            {data.manifest.hw.map((h) => (
              <div
                key={h.position}
                className="grid grid-cols-[74px_1.9fr_1fr_84px] items-center gap-3 border-t border-line px-5 py-2.5"
              >
                <span className="font-mono text-[11px] text-ink-faint">
                  {h.position}
                </span>
                <span className="min-w-0 truncate text-[13px] text-ink">
                  {h.name}
                </span>
                <span className="font-mono text-[12px] font-semibold text-ink">
                  {h.partNumber} {h.rev}
                </span>
                <span className="text-right font-mono text-[11px] text-ink-muted">
                  ×{h.qty}
                </span>
              </div>
            ))}
            <div className="border-t border-line px-5 py-2.5">
              {/* /// PLM.13-BOM — no BOM (D4) screen yet; stub to the Engineering hub. */}
              <Link
                href={data.bomHref}
                className="text-[12.5px] font-semibold text-ink hover:underline"
              >
                View all {data.manifest.hwCount} positions in the BOM →
              </Link>
            </div>

            {/* software */}
            <div className="flex items-center gap-2.5 border-t border-line px-5 pb-1 pt-4">
              <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-faint">
                Software · firmware
              </span>
              <span className="h-px flex-1 bg-line" />
              <span className="font-mono text-[10px] text-success">
                Certified
              </span>
            </div>
            {data.manifest.sw.map((s) => (
              <div
                key={s.kind + s.name}
                className="grid grid-cols-[74px_1.9fr_1fr_84px] items-center gap-3 border-t border-line px-5 py-2.5"
              >
                <span className="font-mono text-[11px] text-ink-faint">
                  {s.kind}
                </span>
                <span className="min-w-0 truncate text-[13px] text-ink">
                  {s.name}
                </span>
                <span className="font-mono text-[12px] font-semibold text-ink">
                  {s.version}
                </span>
                <span
                  className={`text-right font-mono text-[10.5px] ${s.certState === "Certified" ? "text-success" : "text-ink-muted"}`}
                >
                  {s.certState}
                </span>
              </div>
            ))}
          </section>

          {/* DIFF vs version */}
          <section className="overflow-hidden rounded-card border border-line bg-paper">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
              <h2 className="text-[15px] font-semibold text-ink">
                Changes from the previous baseline
              </h2>
              {data.diff && (
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-faint">
                    Compare to
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-lg border border-line-strong bg-panel px-2.5 py-1.5 font-mono text-[11.5px] font-semibold text-ink">
                    {data.diff.a}
                    <ChevronDown
                      size={12}
                      strokeWidth={2.2}
                      className="text-ink-faint"
                    />
                  </span>
                </div>
              )}
            </div>
            {data.diff ? (
              <>
                <div className="grid grid-cols-[74px_1.7fr_1fr_1fr] gap-3 border-b border-line px-5 py-2.5 font-mono text-[9px] uppercase tracking-[0.06em] text-ink-faint">
                  <span>Item</span>
                  <span>Field</span>
                  <span>{data.diff.a}</span>
                  <span>{data.diff.b}</span>
                </div>
                {[...data.diff.hw, ...data.diff.sw].map((r, i) => (
                  // Changed lines read in ink (old value struck); matched lines are
                  // de-emphasised with muted/faint AA-safe colors — NOT opacity (axe
                  // computes contrast including opacity, so dimmed ink would fail AA).
                  <div
                    key={r.key + i}
                    className="grid grid-cols-[74px_1.7fr_1fr_1fr] items-center gap-3 border-b border-line px-5 py-3"
                  >
                    <span className="font-mono text-[11px] text-ink-faint">
                      {i < data.diff!.hw.length ? "HW" : "SW"}
                    </span>
                    <span
                      className={`min-w-0 truncate text-[13px] ${r.differs ? "font-semibold text-ink" : "text-ink-muted"}`}
                    >
                      {r.key}
                    </span>
                    <span
                      className={`font-mono text-[12px] ${r.differs ? "text-ink-muted line-through" : "text-ink-faint"}`}
                    >
                      {r.a ?? "—"}
                    </span>
                    <span
                      className={`font-mono text-[12px] ${r.differs ? "font-semibold text-ink" : "text-ink-muted"}`}
                    >
                      {r.b ?? "—"}
                    </span>
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-3.5 px-5 py-3">
                  <span className="font-mono text-[11px] text-ink">
                    <span className="font-bold">{changedCount}</span> changes
                  </span>
                  <span className="text-line-strong">·</span>
                  <span className="font-mono text-[11px] text-ink-muted">
                    {hwChanged} hardware · {swChanged} software
                  </span>
                  <Link
                    href={data.matchingHref}
                    className="ml-auto text-[12.5px] font-semibold text-ink hover:underline"
                  >
                    Affected units →
                  </Link>
                </div>
              </>
            ) : (
              <p className="px-5 py-6 text-[13px] text-ink-muted">
                No prior baseline to compare against.
              </p>
            )}
          </section>

          {/* change history */}
          <section className="overflow-hidden rounded-card border border-line bg-paper">
            <div className="border-b border-line px-5 py-3.5">
              <h2 className="text-[15px] font-semibold text-ink">
                Change history
              </h2>
              <p className="mt-0.5 text-[12px] text-ink-muted">
                The changes that produced this configuration, and what&apos;s
                queued against it.
              </p>
            </div>
            {data.changes.map((c) => (
              <Link
                key={c.code}
                href={c.href}
                className="grid grid-cols-[90px_1.9fr_1fr_96px] items-center gap-3 border-b border-line px-5 py-3 hover:bg-panel"
              >
                <span className="font-mono text-[12px] font-semibold text-ink">
                  {c.code}
                </span>
                <span className="min-w-0 truncate text-[13px] text-ink">
                  {c.title}
                </span>
                <span className="font-mono text-[11px] text-ink-muted">
                  {c.effectivity}
                </span>
                <span className="justify-self-end">
                  <ChangeStagePill stage={c.stage} />
                </span>
              </Link>
            ))}
          </section>
        </div>

        {/* right rail */}
        <aside className="flex w-[308px] flex-none flex-col gap-4 overflow-y-auto border-l border-line bg-paper p-5">
          {/* matching units → registry */}
          <Link
            href={data.matchingHref}
            className="block rounded-card border border-line p-4 hover:border-ink-strong"
          >
            <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-faint">
              Units on this configuration
            </div>
            <div className="mt-2 flex items-baseline gap-2.5">
              <span className="font-mono text-[34px] font-bold leading-none tracking-[-0.03em] text-ink">
                {data.matchingUnits}
              </span>
              <span className="text-[12.5px] text-ink-muted">
                of {data.totalUnits} built
              </span>
            </div>
            <div className="mt-3 h-[7px] overflow-hidden rounded-pill bg-skeleton">
              <span
                className="block h-[7px] bg-ink-strong"
                style={{
                  width: `${data.totalUnits ? Math.round((data.matchingUnits / data.totalUnits) * 100) : 0}%`,
                }}
              />
            </div>
            <div className="mt-2.5 flex items-center justify-between">
              <span className="font-mono text-[10px] text-ink-faint">
                REGISTRY FILTER
              </span>
              <span className="text-[12px] font-semibold text-ink">View →</span>
            </div>
          </Link>

          {/* lock state */}
          <div className="rounded-card border border-line p-4">
            <div className="flex items-center gap-2.5">
              <span
                className={`inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-md ${data.state === "baseline" ? "bg-success-tint text-success" : "bg-panel text-ink-muted"}`}
              >
                {data.state === "baseline" ? (
                  <Lock size={14} strokeWidth={2} />
                ) : (
                  <Frame size={14} strokeWidth={2} />
                )}
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-ink">
                  {data.state === "baseline"
                    ? "Locked baseline"
                    : data.state === "superseded"
                      ? "Superseded"
                      : "Draft"}
                </div>
                <div className="mt-0.5 font-mono text-[10px] text-ink-faint">
                  {data.state === "baseline"
                    ? "IMMUTABLE"
                    : data.lockAwaitingSecond
                      ? "AWAITING 2ND APPROVER"
                      : "EDITABLE"}
                </div>
              </div>
            </div>
            <p className="mt-2.5 text-[12px] leading-relaxed text-ink-muted">
              {data.state === "baseline"
                ? "Contents can't change. To revise, duplicate as a draft or raise a change order — unlocking needs a second approver."
                : "A draft resolves live. Locking freezes the manifest and needs two approvers — a single approver can't finalize."}
            </p>
            {data.approvers.length > 0 && (
              <div className="mt-3 border-t border-line pt-2.5">
                {data.approvers.map((a) => (
                  <div
                    key={a.role}
                    className="flex items-center justify-between gap-2.5 py-1.5"
                  >
                    <span className="text-[12.5px] text-ink-muted">
                      {a.role}
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-ink">
                      {a.who}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* agent proposal (assistance only · dismissible) */}
          {data.agent && !agentDismissed && (
            <div className="rounded-card border border-line p-4">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-2.5 w-2.5 flex-none rounded-sm bg-ink-strong" />
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-semibold text-ink">
                    Configuration agent
                  </div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.05em] text-ink-faint">
                    Proposal · {Math.round(data.agent.confidence * 100)}%
                    confidence
                  </div>
                </div>
              </div>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink">
                {data.agent.text}
              </p>
              <div className="mt-3 flex gap-2">
                <Link
                  href={data.matchingHref}
                  className="flex-1 rounded-lg bg-accent px-3 py-2 text-center text-[12px] font-semibold text-accent-ink"
                >
                  Review drift
                </Link>
                <button
                  type="button"
                  onClick={() => setAgentDismissed(true)}
                  className="rounded-lg border border-line-strong px-3 py-2 text-[12px] font-semibold text-ink-muted hover:border-ink-strong"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* related */}
          <div className="overflow-hidden rounded-card border border-line">
            <div className="px-4 pb-2.5 pt-3 font-mono text-[9px] uppercase tracking-[0.06em] text-ink-faint">
              Related
            </div>
            {data.related.map((r) => (
              <Link
                key={r.label}
                href={r.href}
                className="flex items-center justify-between gap-2.5 border-t border-line px-4 py-2.5 text-[13px] text-ink hover:bg-panel"
              >
                <span>{r.label}</span>
                <span className="font-mono text-[11px] text-ink-faint">
                  {r.meta}
                </span>
              </Link>
            ))}
          </div>

          {/* LINK.1 — directly connected records across the graph (1-hop). */}
          <ConnectedObjects groups={connected} />
        </aside>
      </div>
    </div>
  );
}

function ChangeStagePill({ stage }: { stage: string }) {
  const s = stage.toUpperCase();
  const cls =
    s === "RELEASED"
      ? "bg-success-tint text-success"
      : s === "REVIEW"
        ? "bg-accent text-accent-ink"
        : "border border-line-panel bg-panel text-ink-muted";
  const label =
    s === "RELEASED"
      ? "Released"
      : s === "REVIEW"
        ? "In review"
        : s.charAt(0) + s.slice(1).toLowerCase();
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[10px] font-semibold tracking-[0.03em] ${cls}`}
    >
      {label}
    </span>
  );
}
