"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CreditCard, Download } from "lucide-react";
import { SettingsShell } from "@/components/settings/SettingsShell";
import type { BillingData } from "@/lib/billing";
import {
  addSeats,
  type BillingActionResult,
} from "@/app/(shell)/settings/billing/actions";

// BILL.3 — Billing & subscription (1:1 with Settings - Billing.dc.html): the plan +
// seats strip, usage bars, payment-method card (display only), and the SaaS invoice
// table. ADMIN edits (change plan / add seats — STUBBED, no real charge); others
// read-only. Numbers are mono + specific. v2 tokens, functional green for Paid.
const PLAN_LABEL: Record<string, string> = {
  PILOT: "Pilot",
  SCALE: "Scale",
  ENTERPRISE: "Enterprise",
};

export function BillingView({
  data,
  isAdmin,
}: {
  data: BillingData;
  isAdmin: boolean;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<BillingActionResult>, okMsg: string) =>
    startTransition(async () => {
      const res = await fn();
      setNotice(res.ok ? okMsg : (res.message ?? "Something went wrong."));
    });

  const seatPct = Math.min(
    100,
    Math.round((data.seatsUsed / data.seatsPurchased) * 100),
  );
  const seatsAvailable = Math.max(0, data.seatsPurchased - data.seatsUsed);

  return (
    <SettingsShell eyebrow="Settings" title="Billing" adminOnly={isAdmin}>
      <div className="mx-auto flex max-w-[860px] flex-col gap-[18px] px-8 py-7">
        {notice && (
          <div
            role="status"
            className="flex items-center gap-2.5 rounded-card border border-line-strong bg-panel px-3.5 py-2.5"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
            <span className="text-[12.5px] font-medium text-ink">{notice}</span>
          </div>
        )}

        {/* plan + seats strip */}
        <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1.3fr_1fr]">
          <section className="relative overflow-hidden rounded-card bg-ink-strong p-6 text-on-dark">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-on-dark-muted">
                  Current plan
                </div>
                <div className="mt-1.5 text-[26px] font-bold tracking-[-0.02em]">
                  {PLAN_LABEL[data.plan]}
                </div>
              </div>
              <span className="rounded-pill bg-accent px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.05em] text-accent-ink">
                {data.status}
              </span>
            </div>
            {data.currentPeriodEnd && (
              <div className="mt-4 text-[12.5px] text-on-dark-muted">
                Renews{" "}
                {data.currentPeriodEnd.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            )}
            <Link
              href="/settings/billing/plans"
              className="mt-5 inline-flex rounded-btn bg-paper px-4 py-2 text-[12.5px] font-semibold text-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Change plan
            </Link>
          </section>

          <section className="flex flex-col rounded-card border border-line bg-paper p-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
              Seats
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="font-mono text-[26px] font-bold tracking-[-0.02em] text-ink">
                {data.seatsUsed}
              </span>
              <span className="text-[13px] text-ink-muted">
                / {data.seatsPurchased} seats used
              </span>
            </div>
            <div className="mt-3.5 h-2.5 overflow-hidden rounded-pill bg-skeleton">
              <span
                className="block h-2.5 bg-ink-strong"
                style={{ width: `${seatPct}%` }}
              />
            </div>
            <div className="mt-2 text-[12px] text-ink-muted">
              {seatsAvailable} seats available
            </div>
            {isAdmin && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(
                    () => addSeats(5),
                    "Added 5 seats (no charge — Stripe deferred).",
                  )
                }
                className="mt-auto rounded-[9px] bg-ink-strong py-2.5 text-[13px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
              >
                Add 5 seats
              </button>
            )}
          </section>
        </div>

        {/* usage */}
        <section className="rounded-card border border-line bg-paper p-6">
          <h2 className="text-[15px] font-semibold text-ink">
            Usage this cycle
          </h2>
          <p className="mb-4 mt-1 text-[12.5px] text-ink-muted">
            Entitlements for the current billing period.
          </p>
          <div className="flex flex-col gap-4">
            {data.usage.map((u) => {
              const pct = u.limit
                ? Math.min(100, Math.round((u.used / u.limit) * 100))
                : 30;
              return (
                <div key={u.label}>
                  <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
                    <span className="text-ink">{u.label}</span>
                    <span className="font-mono text-[12px] text-ink-muted">
                      {u.display}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-pill bg-skeleton">
                    <span
                      className={`block h-2 ${pct >= 90 ? "bg-ink-strong" : "bg-success"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-line pt-3.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-ink-muted">
              Modules enabled
            </span>
            <span className="ml-auto font-mono text-[12px] font-semibold text-ink">
              {data.enabledModuleCount} / {data.totalModules}
            </span>
          </div>
        </section>

        {/* payment method (display only) */}
        <section className="flex flex-wrap items-center gap-4 rounded-card border border-line bg-paper px-6 py-5">
          <span className="inline-flex h-[30px] w-11 flex-none items-center justify-center rounded-[6px] border border-line-strong bg-panel-2 font-mono text-[9px] font-bold tracking-[0.05em] text-ink">
            <CreditCard className="h-4 w-4" strokeWidth={1.8} aria-hidden />
          </span>
          <div className="min-w-[160px] flex-1">
            <div className="text-[13.5px] font-semibold text-ink">
              {data.paymentSummary ?? "No card on file"}
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-ink-muted">
              Managed by Axona billing
            </div>
          </div>
          <button
            type="button"
            disabled
            title="Stripe billing connects in BILL.1"
            className="cursor-not-allowed rounded-btn border border-line-strong bg-paper px-4 py-2 text-[12.5px] font-semibold text-ink-muted opacity-70"
          >
            Update payment
          </button>
        </section>

        {/* invoices */}
        <section className="overflow-hidden rounded-card border border-line bg-paper">
          <div className="flex items-center justify-between px-6 pb-3.5 pt-[18px]">
            <h2 className="text-[15px] font-semibold text-ink">Invoices</h2>
            <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted">
              USD
            </span>
          </div>
          <div className="grid grid-cols-[1.2fr_1.6fr_1fr_1fr_auto] gap-3 border-t border-line px-6 py-2.5 font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted">
            <span>Date</span>
            <span>Description</span>
            <span>Amount</span>
            <span>Status</span>
            <span className="text-right">Invoice</span>
          </div>
          {data.invoices.length === 0 ? (
            <p className="border-t border-line px-6 py-8 text-center text-[13px] text-ink-muted">
              No invoices yet.
            </p>
          ) : (
            data.invoices.map((iv) => (
              <div
                key={iv.id}
                className="grid grid-cols-[1.2fr_1.6fr_1fr_1fr_auto] items-center gap-3 border-t border-line px-6 py-3"
              >
                <span className="font-mono text-[12px] text-ink">
                  {iv.issuedAt.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <span className="truncate text-[12.5px] text-ink-muted">
                  {iv.description}
                </span>
                <span className="font-mono text-[12.5px] font-semibold text-ink">
                  $
                  {(iv.amountCents / 100).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 text-[12px] ${iv.status === "PAID" ? "text-ink" : "text-ink-muted"}`}
                >
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 rounded-full ${iv.status === "PAID" ? "bg-success" : iv.status === "OPEN" ? "bg-accent" : "bg-line-strong"}`}
                  />
                  {iv.status === "PAID"
                    ? "Paid"
                    : iv.status === "OPEN"
                      ? "Open"
                      : "Void"}
                </span>
                <span className="flex items-center justify-end gap-1.5 font-mono text-[11.5px] text-ink-muted">
                  <Download
                    className="h-[13px] w-[13px]"
                    strokeWidth={1.9}
                    aria-hidden
                  />
                  PDF
                </span>
              </div>
            ))
          )}
        </section>

        {isAdmin && (
          <p className="text-center text-[11.5px] text-ink-muted">
            Payments connect via Stripe in a later release — plan &amp; seat
            changes here don’t charge yet.
          </p>
        )}
      </div>
    </SettingsShell>
  );
}
