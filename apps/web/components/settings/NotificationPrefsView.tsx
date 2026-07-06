"use client";

import { useState, useTransition } from "react";
import { SettingsShell } from "@/components/settings/SettingsShell";
import {
  NOTIFICATION_EVENTS,
  type NotificationPrefs,
  type PrefsMap,
} from "@/lib/notification-prefs";
import {
  updatePrefs,
  type PrefsActionResult,
} from "@/app/(shell)/settings/notifications/actions";

// SET.4 — Notification preferences (1:1 with Settings - Notifications.dc.html): an
// event × channel matrix (In-app · Email), a master mute, and quiet hours. Own-user
// only. NOTIF.1's in-app feed honors In-app + mute now; Email is stored + honored by
// NOTIF.3 (flagged). v2 tokens, lime for on.
export function NotificationPrefsView({
  initial,
}: {
  initial: NotificationPrefs;
}) {
  const [prefs, setPrefs] = useState<PrefsMap>(initial.prefs);
  const [muted, setMuted] = useState(initial.muted);
  const [quietStart, setQuietStart] = useState(initial.quietStart ?? "");
  const [quietEnd, setQuietEnd] = useState(initial.quietEnd ?? "");
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (key: string, channel: "inApp" | "email") =>
    setPrefs((p) => {
      const cur = p[key] ?? { inApp: true, email: false };
      return { ...p, [key]: { ...cur, [channel]: !cur[channel] } };
    });

  const save = () =>
    startTransition(async () => {
      const res: PrefsActionResult = await updatePrefs({
        prefs,
        muted,
        quietStart: quietStart || null,
        quietEnd: quietEnd || null,
      });
      setNotice(
        res.ok ? "Preferences saved." : (res.message ?? "Couldn’t save."),
      );
    });

  return (
    <SettingsShell eyebrow="Settings" title="Notifications">
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

        {/* master mute */}
        <section className="flex flex-wrap items-center gap-4 rounded-card border border-line bg-paper p-6">
          <div className="flex-1">
            <h2 className="text-[15px] font-semibold text-ink">
              Mute all notifications
            </h2>
            <p className="mt-1 text-[12.5px] text-ink-muted">
              Pauses the in-app feed and badge. You can still open Notifications
              anytime.
            </p>
          </div>
          <Switch
            on={muted}
            onClick={() => setMuted((v) => !v)}
            label="Mute all notifications"
          />
        </section>

        {/* event × channel matrix */}
        <section
          className={`overflow-hidden rounded-card border border-line bg-paper ${muted ? "opacity-60" : ""}`}
        >
          <div className="px-6 pb-3.5 pt-[18px]">
            <h2 className="text-[15px] font-semibold text-ink">Events</h2>
            <p className="mt-1 text-[12.5px] text-ink-muted">
              Choose how you hear about each event. Email delivery lands with
              NOTIF.3.
            </p>
          </div>
          <div className="grid grid-cols-[1fr_84px_84px] gap-3 border-t border-line px-6 py-2.5 font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted">
            <span>Event</span>
            <span className="text-center">In-app</span>
            <span className="text-center">Email</span>
          </div>
          {NOTIFICATION_EVENTS.map((e) => {
            const p = prefs[e.key] ?? { inApp: true, email: false };
            return (
              <div
                key={e.key}
                className="grid grid-cols-[1fr_84px_84px] items-center gap-3 border-t border-line px-6 py-3.5"
              >
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold text-ink">
                    {e.label}
                  </div>
                  <div className="mt-0.5 text-[12px] text-ink-muted">
                    {e.description}
                  </div>
                </div>
                <div className="flex justify-center">
                  <Switch
                    on={p.inApp}
                    disabled={muted}
                    onClick={() => toggle(e.key, "inApp")}
                    label={`${e.label} in-app`}
                  />
                </div>
                <div className="flex justify-center">
                  <Switch
                    on={p.email}
                    disabled={muted}
                    onClick={() => toggle(e.key, "email")}
                    label={`${e.label} email`}
                  />
                </div>
              </div>
            );
          })}
        </section>

        {/* quiet hours */}
        <section className="rounded-card border border-line bg-paper p-6">
          <h2 className="text-[15px] font-semibold text-ink">Quiet hours</h2>
          <p className="mb-4 mt-1 text-[12.5px] text-ink-muted">
            Suppress email/digest delivery during these hours (honored by
            NOTIF.3). Leave blank for none.
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label
                htmlFor="qs"
                className="mb-1.5 block text-[12px] font-semibold text-ink"
              >
                From
              </label>
              <input
                id="qs"
                type="time"
                value={quietStart}
                onChange={(e) => setQuietStart(e.target.value)}
                className="rounded-[9px] border border-line-strong bg-panel px-[13px] py-2.5 text-[13.5px] text-ink outline-none focus-visible:border-ink-strong focus-visible:ring-[3px] focus-visible:ring-accent"
              />
            </div>
            <div>
              <label
                htmlFor="qe"
                className="mb-1.5 block text-[12px] font-semibold text-ink"
              >
                To
              </label>
              <input
                id="qe"
                type="time"
                value={quietEnd}
                onChange={(e) => setQuietEnd(e.target.value)}
                className="rounded-[9px] border border-line-strong bg-panel px-[13px] py-2.5 text-[13.5px] text-ink outline-none focus-visible:border-ink-strong focus-visible:ring-[3px] focus-visible:ring-accent"
              />
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-[9px] bg-ink-strong px-5 py-2.5 text-[13px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save preferences"}
          </button>
        </div>
      </div>
    </SettingsShell>
  );
}

function Switch({
  on,
  onClick,
  disabled = false,
  label,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative h-[19px] w-[34px] flex-none rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 ${
        on ? "bg-accent" : "bg-line-strong"
      }`}
    >
      <span
        className={`absolute top-0.5 h-[15px] w-[15px] rounded-full transition-all ${on ? "left-[17px] bg-ink-strong" : "left-0.5 bg-paper"}`}
      />
    </button>
  );
}
