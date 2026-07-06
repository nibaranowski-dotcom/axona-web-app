"use client";

import { useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { SettingsShell } from "@/components/settings/SettingsShell";
import type { Plan } from "@/lib/billing";
import type { PlanTier } from "@axona/db";
import { changePlan } from "@/app/(shell)/settings/billing/actions";

// BILL.3 — Plans / upgrade (1:1 with Settings - Plans.dc.html): 3 dotted-grid tier
// cards, the recommended tier in lime, the current tier marked. Change is STUBBED
// (no real charge). ADMIN only can switch.
export function PlansView({
  plans,
  currentTier,
  isAdmin,
}: {
  plans: Plan[];
  currentTier: PlanTier;
  isAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const pick = (tier: PlanTier) =>
    startTransition(async () => {
      await changePlan(tier);
    });

  return (
    <SettingsShell eyebrow="Settings · Billing" title="Plans">
      <div className="mx-auto flex max-w-[940px] flex-col gap-5 px-8 py-7">
        <Link
          href="/settings/billing"
          className="inline-flex w-fit items-center gap-1.5 text-[12.5px] font-semibold text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
          Back to billing
        </Link>

        <div className="mb-1 text-center">
          <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">
            Choose your plan
          </h2>
          <p className="mx-auto mt-1.5 max-w-[52ch] text-[13.5px] text-ink-muted">
            Every plan ships with agents. Plan changes here don’t charge yet —
            Stripe connects in a later release.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {plans.map((p) => {
            const isCurrent = p.tier === currentTier;
            return (
              <div
                key={p.tier}
                className={`relative flex flex-col rounded-card border p-6 ${
                  p.recommended ? "border-ink-strong" : "border-line"
                } bg-paper`}
                style={{
                  backgroundImage:
                    "radial-gradient(var(--line-strong) 1px, transparent 1px)",
                  backgroundSize: "16px 16px",
                }}
              >
                {p.recommended && (
                  <span className="absolute -top-2.5 left-6 rounded-pill bg-accent px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.05em] text-accent-ink">
                    Recommended
                  </span>
                )}
                <div className="flex items-center justify-between">
                  <h3 className="text-[17px] font-bold text-ink">{p.name}</h3>
                  {isCurrent && (
                    <span className="rounded-pill border border-line-strong px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.05em] text-ink-muted">
                      Current
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  {p.tier === "ENTERPRISE" ? (
                    <span className="font-mono text-[22px] font-bold text-ink">
                      Talk to us
                    </span>
                  ) : (
                    <>
                      <span className="font-mono text-[26px] font-bold text-ink">
                        ${p.priceMonthly.toLocaleString()}
                      </span>
                      <span className="text-[12.5px] text-ink-muted">/ mo</span>
                    </>
                  )}
                </div>
                <div className="mt-1 font-mono text-[11px] text-ink-muted">
                  {p.seatsIncluded} · {p.runLimit}
                </div>
                <ul className="mt-4 flex flex-col gap-2">
                  {p.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-[12.5px] text-ink"
                    >
                      <Check
                        className="mt-px h-[15px] w-[15px] flex-none text-ink-strong"
                        strokeWidth={2.4}
                        aria-hidden
                      />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 pt-2">
                  {isCurrent ? (
                    <button
                      type="button"
                      disabled
                      className="w-full cursor-default rounded-[9px] border border-line-strong bg-panel py-2.5 text-[13px] font-semibold text-ink-muted"
                    >
                      Current plan
                    </button>
                  ) : p.tier === "ENTERPRISE" ? (
                    <a
                      href="mailto:sales@axona.co"
                      className="block w-full rounded-[9px] border border-line-strong bg-paper py-2.5 text-center text-[13px] font-semibold text-ink transition-colors hover:border-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      Contact sales
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled={!isAdmin || pending}
                      onClick={() => pick(p.tier)}
                      className={`w-full rounded-[9px] py-2.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60 ${
                        p.recommended
                          ? "bg-ink-strong text-on-dark hover:bg-black"
                          : "border border-line-strong bg-paper text-ink hover:border-ink-strong"
                      }`}
                    >
                      {isAdmin ? `Switch to ${p.name}` : "Admins only"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SettingsShell>
  );
}
