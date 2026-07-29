"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LeadStatus } from "@axona/db";
import type { LeadsResult, LeadRow } from "@/lib/leads";
import { ScreenShell } from "@/components/shell/ScreenShell";
import { setLeadStatusAction } from "@/app/(shell)/leads/actions";

// LEAD.1 — the internal Leads triage table (`/leads`). Newest-first, each lead's fields
// + a status control (NEW→CONTACTED→QUALIFIED→CLOSED). ADMIN-gated by the page. v2
// tokens · no emoji · no invented reds (statuses use ink / functional green).

const STATUS_OPTIONS: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "CLOSED",
];

const STATUS_PILL: Record<LeadStatus, string> = {
  NEW: "bg-accent text-accent-ink",
  CONTACTED: "border border-line-panel bg-panel text-ink",
  QUALIFIED: "bg-success-tint text-success",
  CLOSED: "border border-line-panel bg-panel text-ink-muted",
};

const STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  CLOSED: "Closed",
};

const COLS =
  "grid grid-cols-[1.4fr_1.2fr_0.8fr_120px_150px] items-start gap-4 px-5";

export function LeadsView({ data }: { data: LeadsResult }) {
  return (
    <ScreenShell header={<Header total={data.summary.total} />}>
      <div className="flex flex-col gap-4 px-6 py-5">
        {/* stat strip — counts by status */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STATUS_OPTIONS.map((s) => (
            <div
              key={s}
              className="rounded-card border border-line bg-paper px-4 py-3"
            >
              <div className="font-mono text-[22px] font-bold leading-none tracking-[-0.03em] text-ink">
                {data.summary.byStatus[s]}
              </div>
              <div className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.05em] text-ink-faint">
                {STATUS_LABEL[s]}
              </div>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-card border border-line bg-paper">
          <div
            className={`${COLS} border-b border-line py-2.5 font-mono text-[9px] uppercase tracking-[0.06em] text-ink-faint`}
          >
            <span>Contact</span>
            <span>Company</span>
            <span>Fleet</span>
            <span>Received</span>
            <span>Status</span>
          </div>
          {data.rows.length === 0 ? (
            <p className="px-5 py-12 text-center text-[13px] text-ink-muted">
              No leads yet — contact-sales inquiries will appear here.
            </p>
          ) : (
            data.rows.map((lead) => <LeadRowItem key={lead.id} lead={lead} />)
          )}
        </div>
      </div>
    </ScreenShell>
  );
}

function Header({ total }: { total: number }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
        Go-to-market · leads
      </div>
      <h1 className="mt-0.5 flex items-center gap-2.5 font-sans text-[19px] font-semibold tracking-[-0.02em] text-ink">
        Leads
        <span className="font-mono text-[11px] font-normal text-ink-faint">
          {total} total
        </span>
      </h1>
    </div>
  );
}

function LeadRowItem({ lead }: { lead: LeadRow }) {
  const router = useRouter();
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const change = (next: LeadStatus) => {
    const prev = status;
    setStatus(next);
    setError(null);
    startTransition(async () => {
      try {
        await setLeadStatusAction(lead.id, next);
        router.refresh();
      } catch (e) {
        setStatus(prev);
        setError(e instanceof Error ? e.message : "Update failed.");
      }
    });
  };

  return (
    <div className={`${COLS} border-b border-line py-3.5`}>
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-ink">{lead.name}</div>
        <div className="truncate font-mono text-[11px] text-ink-muted">
          {lead.workEmail}
        </div>
        {lead.role && (
          <div className="mt-0.5 text-[11px] text-ink-faint">{lead.role}</div>
        )}
        {lead.message && (
          <div className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-ink-muted">
            {lead.message}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13px] text-ink">{lead.company}</div>
        {lead.useCase && (
          <div className="mt-0.5 text-[11px] text-ink-muted">
            {lead.useCase}
          </div>
        )}
        <div className="mt-1 font-mono text-[10px] text-ink-faint">
          {lead.source}
        </div>
      </div>
      <div className="font-mono text-[12px] text-ink-muted">
        {lead.fleetSize ?? "—"}
      </div>
      <div className="font-mono text-[11px] text-ink-muted">
        {lead.createdAt.toISOString().slice(0, 10)}
      </div>
      <div>
        <span
          className={`mb-1.5 inline-flex items-center rounded-pill px-2 py-0.5 text-[10px] font-semibold tracking-[0.03em] ${STATUS_PILL[status]}`}
        >
          {STATUS_LABEL[status]}
        </span>
        <label className="block">
          <span className="sr-only">Lead status for {lead.name}</span>
          <select
            value={status}
            disabled={pending}
            onChange={(e) => change(e.target.value as LeadStatus)}
            className="w-full rounded-md border border-line-strong bg-paper px-2 py-1 font-sans text-[12px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="mt-1 text-[10px] text-ink">{error}</p>}
      </div>
    </div>
  );
}
