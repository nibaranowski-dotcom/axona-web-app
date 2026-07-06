"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { AlertTriangle, Eye, EyeOff } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";
import {
  setNewPasswordAction,
  type SetPasswordState,
} from "@/app/reset/actions";

// AUTH.7 — /reset/:token set-new-password. On success the action signs the user in
// (old sessions were invalidated by the tokenVersion bump) → /core.
export function SetNewPasswordForm({
  token,
  email,
}: {
  token: string;
  email?: string;
}) {
  const [state, formAction] = useFormState<SetPasswordState, FormData>(
    setNewPasswordAction,
    {},
  );
  const [show, setShow] = useState(false);
  return (
    <AuthCard
      ariaLabel="Set a new password"
      subtitle="Reset your password"
      title="Choose a new password"
    >
      {email && (
        <p className="mb-4 text-center text-[12.5px] text-ink-muted">
          for {email}
        </p>
      )}
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
          <span className="text-[12.5px] font-medium text-on-dark">
            {state.error}
          </span>
        </div>
      )}
      <form action={formAction} noValidate>
        <input type="hidden" name="token" value={token} />
        <label
          htmlFor="np-password"
          className="mb-1.5 block text-[12px] font-semibold text-ink"
        >
          New password
        </label>
        <div className="flex items-center gap-2.5 rounded-[9px] border border-line-strong bg-paper px-[13px] focus-within:border-ink-strong focus-within:ring-[3px] focus-within:ring-accent">
          <input
            id="np-password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            className="min-w-0 flex-1 border-none bg-transparent py-[11px] text-[13.5px] tracking-[0.12em] text-ink outline-none placeholder:tracking-normal placeholder:text-ink-muted"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide password" : "Show password"}
            className="inline-flex text-ink-faint transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {show ? (
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
        <SubmitButton />
      </form>
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
      {pending ? "Updating…" : "Set password & sign in"}
    </button>
  );
}
