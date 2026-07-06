"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { AlertTriangle, ArrowRight, Eye, EyeOff, Lock } from "lucide-react";
import {
  acceptInviteAction,
  type AcceptState,
} from "@/app/invite/accept-action";
import type { InviteView } from "@/lib/invites";

// AUTH.5 — the accept-invite card (1:1 with Accept Invite.dc.html): inviter → org
// glyphs, "{invitedByLabel} invited you to join {Org.name} on Axona", the role as
// a mono pill, then Your name · Email (locked) · Set password, and "Join {Org}".
// Submits via the public accept action → creates the user at the invited role +
// auto sign-in → /core. Field errors in ink (no invented reds). v2 tokens.
export function AcceptInviteForm({ invite }: { invite: InviteView }) {
  const [state, formAction] = useFormState<AcceptState, FormData>(
    acceptInviteAction,
    {},
  );
  const [showPw, setShowPw] = useState(false);
  const initials =
    invite.invitedByLabel
      .split(" ")
      .map((w) => w[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase() || "AX";

  return (
    <main
      aria-label="Accept invite"
      className="flex min-h-dvh items-center justify-center bg-panel px-8 py-12 font-sans text-ink"
    >
      <div className="relative w-full max-w-[440px] overflow-hidden rounded-[20px] border border-line bg-paper">
        <div className="px-10 pb-[30px] pt-10">
          {/* wordmark */}
          <div className="mb-[26px] flex justify-center">
            <span className="text-[21px] font-bold tracking-[-0.045em] text-ink-strong">
              axona
            </span>
          </div>

          {/* inviter → org */}
          <div className="mb-2 flex flex-col items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line-strong bg-panel-2 text-[13px] font-bold text-ink-muted">
                {initials}
              </span>
              <ArrowRight
                className="h-[18px] w-[18px] text-ink-faint"
                strokeWidth={1.8}
                aria-hidden
              />
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-[12px] bg-accent">
                <span
                  aria-hidden
                  className="h-[22px] w-[22px] bg-ink-strong"
                  style={{ borderRadius: "0 7px 0 7px" }}
                />
              </span>
            </div>
          </div>

          {/* heading */}
          <h1 className="mt-5 text-center text-[19px] font-semibold leading-[1.35] tracking-[-0.02em]">
            <span className="font-bold">{invite.invitedByLabel}</span> invited
            you to join <span className="font-bold">{invite.orgName}</span> on
            Axona
          </h1>

          <div className="my-[14px] mb-6 flex items-center justify-center gap-2">
            <span className="text-[12.5px] text-ink-muted">Your role</span>
            <span className="rounded-pill bg-ink-strong px-2.5 py-[3px] font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-on-dark">
              {invite.role}
            </span>
          </div>

          {state.error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2.5 rounded-[10px] bg-ink-strong px-3.5 py-3"
            >
              <AlertTriangle
                className="mt-px h-4 w-4 flex-none text-on-dark"
                strokeWidth={2.2}
                aria-hidden
              />
              <div className="leading-[1.4]">
                <div className="mb-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-accent">
                  Couldn’t join
                </div>
                <span className="text-[12.5px] font-medium text-on-dark">
                  {state.error}
                </span>
              </div>
            </div>
          )}

          <form action={formAction} noValidate>
            <input type="hidden" name="token" value={invite.token} />

            <div className="mb-3.5">
              <label
                htmlFor="iv-name"
                className="mb-1.5 block text-[12px] font-semibold text-ink"
              >
                Your name
              </label>
              <div className="rounded-[9px] border border-line-strong bg-panel px-[13px] transition-colors focus-within:border-ink-strong focus-within:ring-[3px] focus-within:ring-accent">
                <input
                  id="iv-name"
                  name="name"
                  autoComplete="name"
                  required
                  placeholder="First and last name"
                  className="w-full border-none bg-transparent py-[11px] text-[13.5px] text-ink outline-none placeholder:text-ink-muted"
                />
              </div>
            </div>

            {/* email — locked to the invited address */}
            <div className="mb-3.5">
              <label
                htmlFor="iv-email"
                className="mb-1.5 block text-[12px] font-semibold text-ink"
              >
                Email
              </label>
              <div className="flex items-center gap-2.5 rounded-[9px] border border-line-strong bg-panel px-[13px]">
                <input
                  id="iv-email"
                  value={invite.email}
                  disabled
                  aria-label="Invited email (locked)"
                  className="min-w-0 flex-1 border-none bg-transparent py-[11px] text-[13.5px] text-ink-muted outline-none"
                />
                <Lock
                  className="h-[15px] w-[15px] flex-none text-ink-faint"
                  strokeWidth={1.8}
                  aria-hidden
                />
              </div>
            </div>

            <div className="mb-[22px]">
              <label
                htmlFor="iv-password"
                className="mb-1.5 block text-[12px] font-semibold text-ink"
              >
                Set password
              </label>
              <div className="flex items-center gap-2.5 rounded-[9px] border border-line-strong bg-panel px-[13px] transition-colors focus-within:border-ink-strong focus-within:ring-[3px] focus-within:ring-accent">
                <input
                  id="iv-password"
                  name="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="Create a password"
                  className="min-w-0 flex-1 border-none bg-transparent py-[11px] text-[13.5px] tracking-[0.12em] text-ink outline-none placeholder:tracking-normal placeholder:text-ink-muted"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="inline-flex text-ink-faint transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {showPw ? (
                    <EyeOff
                      className="h-[17px] w-[17px]"
                      strokeWidth={1.8}
                      aria-hidden
                    />
                  ) : (
                    <Eye
                      className="h-[17px] w-[17px]"
                      strokeWidth={1.8}
                      aria-hidden
                    />
                  )}
                </button>
              </div>
            </div>

            <JoinButton orgName={invite.orgName} />
          </form>
        </div>
      </div>
    </main>
  );
}

function JoinButton({ orgName }: { orgName: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-[9px] bg-ink-strong py-[13px] text-[14px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
    >
      {pending ? "Joining…" : `Join ${orgName}`}
    </button>
  );
}
