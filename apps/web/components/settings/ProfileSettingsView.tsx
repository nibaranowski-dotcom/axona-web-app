"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Laptop, Smartphone } from "lucide-react";
import { SettingsShell } from "@/components/settings/SettingsShell";
import type { UserSettings } from "@/lib/user-settings";
import { deviceLabel } from "@/lib/user-settings";
import {
  updateProfile,
  changePassword,
  signOutEverywhere,
  revokeSession,
  type ProfileActionResult,
} from "@/app/(shell)/settings/profile/actions";

// SET.3 — Your profile & security (1:1 with Settings - Profile.dc.html): Profile
// (name editable · email + role read-only), Password (current → new + confirm →
// bumps tokenVersion), and Sessions & devices (list + revoke + sign out
// everywhere). The signed-in user edits their OWN record. v2 tokens, no reds.
export function ProfileSettingsView({ settings }: { settings: UserSettings }) {
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(settings.name);

  const run = (
    fn: () => Promise<ProfileActionResult>,
    okMsg: string,
    after?: () => void,
  ) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setNotice(okMsg);
        setError(null);
        after?.();
      } else {
        setError(res.message ?? "Something went wrong.");
        setNotice(null);
      }
    });

  const initials =
    settings.name
      .split(/[ @.]/)
      .map((w) => w[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  return (
    <SettingsShell eyebrow="Settings" title="Your profile">
      <div className="mx-auto flex max-w-[760px] flex-col gap-[18px] px-8 py-7">
        {notice && (
          <div
            role="status"
            className="flex items-center gap-2.5 rounded-card border border-line-strong bg-panel px-3.5 py-2.5"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
            <span className="text-[12.5px] font-medium text-ink">{notice}</span>
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="flex items-center gap-2.5 rounded-card border border-line-strong bg-ink-strong px-3.5 py-2.5"
          >
            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-accent">
              Couldn’t save
            </span>
            <span className="text-[12.5px] font-medium text-on-dark">
              {error}
            </span>
          </div>
        )}

        {/* Profile */}
        <section className="rounded-card border border-line bg-paper p-6">
          <h2 className="text-[15px] font-semibold text-ink">Profile</h2>
          <p className="mb-[18px] mt-1 text-[12.5px] text-ink-muted">
            Your personal details.
          </p>
          <div className="flex flex-wrap items-start gap-5">
            <div className="flex flex-col items-center gap-2">
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-accent text-[20px] font-bold text-accent-ink">
                {initials}
              </span>
              <button
                type="button"
                disabled
                title="Avatar upload lands in a follow-up"
                className="cursor-not-allowed rounded-btn border border-line-strong bg-panel px-2.5 py-1.5 text-[11px] text-ink-muted opacity-70"
              >
                Change
              </button>
            </div>
            <div className="grid min-w-[260px] flex-1 grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="pf-name"
                  className="mb-1.5 block text-[12px] font-semibold text-ink"
                >
                  Full name
                </label>
                <input
                  id="pf-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-[9px] border border-line-strong bg-panel px-[13px] py-2.5 text-[13.5px] text-ink outline-none focus-visible:border-ink-strong focus-visible:ring-[3px] focus-visible:ring-accent"
                />
              </div>
              <div>
                <span className="mb-1.5 block text-[12px] font-semibold text-ink">
                  Role
                </span>
                <div className="flex h-[39px] items-center">
                  <span className="rounded-pill bg-panel-2 px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.05em] text-ink">
                    {settings.role}
                  </span>
                  <span className="ml-2.5 text-[11px] text-ink-muted">
                    Set by an admin
                  </span>
                </div>
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="pf-email"
                  className="mb-1.5 block text-[12px] font-semibold text-ink"
                >
                  Email
                </label>
                <input
                  id="pf-email"
                  value={settings.email}
                  disabled
                  aria-label="Email (read-only)"
                  className="w-full rounded-[9px] border border-line-strong bg-panel px-[13px] py-2.5 font-mono text-[13px] text-ink-muted outline-none"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <SaveButton
              pending={pending}
              onClick={() =>
                run(() => updateProfile({ name }), "Profile saved.")
              }
            >
              Save profile
            </SaveButton>
          </div>
        </section>

        <PasswordSection pending={pending} run={run} />

        {/* Sessions & devices */}
        <section className="overflow-hidden rounded-card border border-line bg-paper">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-4 pt-5">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">
                Sessions &amp; devices
              </h2>
              <p className="mt-1 text-[12.5px] text-ink-muted">
                Where you’re signed in. Revoke anything you don’t recognize —
                full sign-out uses “Sign out everywhere”.
              </p>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(
                  () => signOutEverywhere().then(() => ({ ok: true })),
                  "Signing out…",
                )
              }
              className="rounded-btn border border-line-strong bg-paper px-3.5 py-2 text-[12.5px] font-semibold text-ink-muted transition-colors hover:border-ink-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Sign out everywhere
            </button>
          </div>
          <div className="grid grid-cols-[2fr_1.3fr_1fr_auto] gap-3 border-t border-line px-6 py-2.5 font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted">
            <span>Device</span>
            <span>IP</span>
            <span>Last seen</span>
            <span className="sr-only">Actions</span>
          </div>
          {settings.sessions.length === 0 ? (
            <p className="border-t border-line px-6 py-8 text-center text-[13px] text-ink-muted">
              No active sessions recorded.
            </p>
          ) : (
            settings.sessions.map((s, i) => {
              const label = deviceLabel(s.device);
              const isMobile = /iOS|Android/.test(label);
              return (
                <div
                  key={s.id}
                  className="grid grid-cols-[2fr_1.3fr_1fr_auto] items-center gap-3 border-t border-line px-6 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-[8px] bg-panel-2 text-ink-muted">
                      {isMobile ? (
                        <Smartphone
                          className="h-4 w-4"
                          strokeWidth={1.8}
                          aria-hidden
                        />
                      ) : (
                        <Laptop
                          className="h-4 w-4"
                          strokeWidth={1.8}
                          aria-hidden
                        />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13.5px] font-semibold text-ink">
                          {label}
                        </span>
                        {i === 0 && (
                          <span className="flex-none rounded-pill bg-accent px-[7px] py-0.5 font-mono text-[9px] font-bold tracking-[0.04em] text-accent-ink">
                            THIS DEVICE
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="font-mono text-[11px] text-ink-muted">
                    {s.ip ?? "—"}
                  </span>
                  <span className="font-mono text-[11px] text-ink-muted">
                    {relTime(s.lastSeenAt)}
                  </span>
                  <div className="flex justify-end">
                    {i === 0 ? (
                      <span className="font-mono text-[11px] text-ink-muted">
                        —
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          run(() => revokeSession(s.id), "Session revoked.")
                        }
                        className="rounded-btn border border-line-strong bg-paper px-3 py-1.5 text-[12px] font-semibold text-ink-muted transition-colors hover:border-ink-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>
    </SettingsShell>
  );
}

function PasswordSection({
  pending,
  run,
}: {
  pending: boolean;
  run: (
    fn: () => Promise<ProfileActionResult>,
    okMsg: string,
    after?: () => void,
  ) => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCur, setShowCur] = useState(false);
  const [mismatch, setMismatch] = useState(false);

  const submit = () => {
    if (next !== confirm) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    run(
      () => changePassword({ current, next }),
      "Password updated — other sessions were signed out.",
      () => {
        setCurrent("");
        setNext("");
        setConfirm("");
      },
    );
  };

  return (
    <section className="rounded-card border border-line bg-paper p-6">
      <h2 className="text-[15px] font-semibold text-ink">Password</h2>
      <p className="mb-[18px] mt-1 text-[12.5px] text-ink-muted">
        Change the password you use to sign in.
      </p>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div className="sm:col-span-2 sm:max-w-[calc(50%-7px)]">
          <label
            htmlFor="pf-current"
            className="mb-1.5 block text-[12px] font-semibold text-ink"
          >
            Current password
          </label>
          <div className="flex items-center gap-2.5 rounded-[9px] border border-line-strong bg-panel px-[13px] focus-within:border-ink-strong focus-within:ring-[3px] focus-within:ring-accent">
            <input
              id="pf-current"
              type={showCur ? "text" : "password"}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              className="min-w-0 flex-1 border-none bg-transparent py-2.5 text-[13.5px] tracking-[0.12em] text-ink outline-none"
            />
            <button
              type="button"
              onClick={() => setShowCur((v) => !v)}
              aria-label={showCur ? "Hide password" : "Show password"}
              className="inline-flex text-ink-faint transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {showCur ? (
                <EyeOff className="h-4 w-4" strokeWidth={1.8} aria-hidden />
              ) : (
                <Eye className="h-4 w-4" strokeWidth={1.8} aria-hidden />
              )}
            </button>
          </div>
        </div>
        <div>
          <label
            htmlFor="pf-new"
            className="mb-1.5 block text-[12px] font-semibold text-ink"
          >
            New password
          </label>
          <input
            id="pf-new"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            className="w-full rounded-[9px] border border-line-strong bg-panel px-[13px] py-2.5 text-[13.5px] tracking-[0.12em] text-ink outline-none focus-visible:border-ink-strong focus-visible:ring-[3px] focus-visible:ring-accent"
          />
        </div>
        <div>
          <label
            htmlFor="pf-confirm"
            className="mb-1.5 block text-[12px] font-semibold text-ink"
          >
            Confirm new password
          </label>
          <input
            id="pf-confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="w-full rounded-[9px] border border-line-strong bg-panel px-[13px] py-2.5 text-[13.5px] tracking-[0.12em] text-ink outline-none focus-visible:border-ink-strong focus-visible:ring-[3px] focus-visible:ring-accent"
          />
        </div>
      </div>
      {mismatch && (
        <p role="alert" className="mt-2.5 text-[12px] font-medium text-ink">
          The new passwords don’t match.
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <SaveButton pending={pending} onClick={submit}>
          Update password
        </SaveButton>
      </div>
    </section>
  );
}

function SaveButton({
  pending,
  onClick,
  children,
}: {
  pending: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="rounded-[9px] bg-ink-strong px-5 py-2.5 text-[13px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
    >
      {pending ? "Saving…" : children}
    </button>
  );
}

function relTime(d: Date | null): string {
  if (!d) return "—";
  const secs = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
