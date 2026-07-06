"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import {
  requestResetAction,
  type ResetRequestState,
} from "@/app/reset/actions";

// AUTH.7 — /reset request. Email → "check your inbox" confirmation (shown the same
// whether or not the email exists — anti-enumeration).
export function ResetRequestForm() {
  const [state, formAction] = useFormState<ResetRequestState, FormData>(
    requestResetAction,
    {},
  );
  if (state.sent) {
    return (
      <AuthCard
        ariaLabel="Reset password"
        subtitle="Reset your password"
        title="Check your inbox"
      >
        <p className="text-center text-[13px] leading-[1.5] text-ink-muted">
          If an account exists for that email, we’ve sent a link to reset your
          password. It expires in 1 hour.
        </p>
        <Link
          href="/login"
          className="mt-5 block text-center text-[12.5px] font-semibold text-ink transition-opacity hover:opacity-60"
        >
          Back to log in
        </Link>
      </AuthCard>
    );
  }
  return (
    <AuthCard
      ariaLabel="Reset password"
      subtitle="Reset your password"
      title="Forgot your password?"
    >
      <p className="mb-4 text-center text-[12.5px] leading-[1.5] text-ink-muted">
        Enter your work email and we’ll send a reset link.
      </p>
      <form action={formAction} noValidate>
        <label
          htmlFor="rs-email"
          className="mb-1.5 block text-[12px] font-semibold text-ink"
        >
          Work email
        </label>
        <div className="rounded-[9px] border border-line-strong bg-paper px-[13px] focus-within:border-ink-strong focus-within:ring-[3px] focus-within:ring-accent">
          <input
            id="rs-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@company.com"
            className="w-full border-none bg-transparent py-[11px] text-[13.5px] text-ink outline-none placeholder:text-ink-muted"
          />
        </div>
        <SubmitButton />
      </form>
      <Link
        href="/login"
        className="mt-4 block text-center text-[12.5px] text-ink-muted transition-opacity hover:opacity-60"
      >
        Back to log in
      </Link>
    </AuthCard>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-4 w-full rounded-[9px] bg-ink-strong py-[13px] text-[14px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
    >
      {pending ? "Sending…" : "Send reset link"}
    </button>
  );
}
