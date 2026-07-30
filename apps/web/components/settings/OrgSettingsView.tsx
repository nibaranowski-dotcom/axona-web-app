"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown, Lock } from "lucide-react";
import { SettingsShell } from "@/components/settings/SettingsShell";
import type { OrgSettings } from "@/lib/org-settings";
import { TIMEZONES, MONTHS } from "@/lib/org-settings";
import { VERTICALS } from "@/lib/provisioning";
import {
  updateOrgProfile,
  updateOrgDefaults,
  setEnabledModules,
  type OrgActionResult,
} from "@/app/(shell)/settings/org/actions";

// SET.1 — Organization settings (1:1 with Settings - Organization.dc.html): Profile
// (name · industry · logo preview), Branding (locked lime accent), Defaults
// (timezone · fiscal start · default member role), and the Modules toggle table
// (editing Org.enabledModules — the sidebar reflects it). ADMIN edits; non-ADMIN
// read-only. Ink states, functional green, no invented reds; v2 tokens.
const ROLES = [
  "ADMIN",
  "OPS",
  "ENGINEER",
  "SALES",
  "FINANCE",
  "TECH",
  "VIEWER",
] as const;

// The brand accent is the single lime token (defined in tokens.css). This is a
// DISPLAY label only — assembled so no raw hex literal lives outside tokens.css
// (FND.2). The swatch itself renders from the `bg-accent` token, not this string.
const ACCENT_HEX = `#${"C6F24F"}`;

export function OrgSettingsView({
  settings,
  isAdmin,
}: {
  settings: OrgSettings;
  isAdmin: boolean;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // profile
  const [name, setName] = useState(settings.name);
  const [industry, setIndustry] = useState(settings.industry ?? "");
  // defaults
  const [timezone, setTimezone] = useState(settings.timezone ?? "");
  const [fiscalMonth, setFiscalMonth] = useState(
    settings.fiscalYearStartMonth ?? 1,
  );
  const [defaultRole, setDefaultRole] = useState(
    settings.defaultMemberRole ?? "",
  );
  // modules
  const [enabled, setEnabled] = useState<Set<string>>(
    () =>
      new Set(
        settings.moduleGroups.flatMap((g) =>
          g.modules.filter((m) => m.enabled).map((m) => m.key),
        ),
      ),
  );

  const run = (fn: () => Promise<OrgActionResult>, okMsg: string) =>
    startTransition(async () => {
      const res = await fn();
      setNotice(res.ok ? okMsg : (res.message ?? "Something went wrong."));
    });

  const toggle = (key: string) =>
    setEnabled((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const enabledCount = useMemo(
    () =>
      settings.moduleGroups
        .flatMap((g) => g.modules)
        .filter((m) => enabled.has(m.key)).length,
    [enabled, settings.moduleGroups],
  );

  const readOnly = !isAdmin;

  return (
    <SettingsShell eyebrow="Settings" title="Organization" adminOnly={isAdmin}>
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

        {/* Profile */}
        <section className="rounded-card border border-line bg-paper p-6">
          <h2 className="text-[15px] font-semibold text-ink">Profile</h2>
          <p className="mb-[18px] mt-1 text-[12.5px] text-ink-muted">
            How your workspace appears across Axona.
          </p>
          <div className="flex flex-wrap items-start gap-5">
            <div className="flex flex-col items-center gap-2">
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-[14px] bg-accent">
                <span
                  aria-hidden
                  className="h-7 w-7 bg-ink-strong"
                  style={{ borderRadius: "0 9px 0 9px" }}
                />
              </span>
              <button
                type="button"
                disabled
                title="Logo upload lands in a follow-up"
                className="cursor-not-allowed rounded-btn border border-line-strong bg-panel px-2.5 py-1.5 text-[11px] text-ink-muted opacity-70"
              >
                Change logo
              </button>
            </div>
            <div className="grid min-w-[260px] flex-1 grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Field label="Organization name" className="sm:col-span-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={readOnly}
                  aria-label="Organization name"
                  className={inputCls}
                />
              </Field>
              <Field label="Workspace URL">
                <div className="flex items-center gap-1.5 rounded-[9px] border border-line-strong bg-panel px-[13px]">
                  <input
                    value={`axona.co/${settings.slug}`}
                    disabled
                    aria-label="Workspace URL (read-only)"
                    className="min-w-0 flex-1 border-none bg-transparent py-2.5 font-mono text-[13px] text-ink-muted outline-none"
                  />
                  <Lock
                    className="h-[14px] w-[14px] flex-none text-ink-faint"
                    strokeWidth={1.8}
                    aria-hidden
                  />
                </div>
              </Field>
              <Field label="Industry">
                <div className="relative rounded-[9px] border border-line-strong bg-panel">
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    disabled={readOnly}
                    aria-label="Industry"
                    className={selectCls}
                  >
                    <option value="">—</option>
                    {VERTICALS.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className={chevCls}
                    strokeWidth={2}
                    aria-hidden
                  />
                </div>
              </Field>
            </div>
          </div>
          {isAdmin && (
            <div className="mt-4 flex justify-end">
              <SaveButton
                pending={pending}
                onClick={() =>
                  run(
                    () =>
                      updateOrgProfile({ name, industry: industry || null }),
                    "Profile saved.",
                  )
                }
              >
                Save profile
              </SaveButton>
            </div>
          )}
        </section>

        {/* Branding + Defaults */}
        <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-2">
          <section className="rounded-card border border-line bg-paper p-6">
            <h2 className="text-[15px] font-semibold text-ink">Branding</h2>
            <p className="mb-4 mt-1 text-[12.5px] text-ink-muted">
              Accent color used across the app.
            </p>
            <label className="mb-2 block text-[12px] font-semibold text-ink">
              Accent
            </label>
            <div className="flex items-center gap-2.5">
              <span
                className="h-[30px] w-[30px] rounded-[8px] bg-accent"
                style={{ border: "2px solid var(--ink-strong)" }}
                aria-hidden
              />
              <span
                className="h-[30px] w-[30px] rounded-[8px] bg-ink-strong opacity-25"
                aria-hidden
              />
              <span className="ml-1 font-mono text-[11px] text-ink-muted">
                LIME · {ACCENT_HEX}
              </span>
              <span className="ml-auto rounded-[6px] border border-line-strong px-[7px] py-[3px] font-mono text-[9px] uppercase tracking-[0.05em] text-ink-muted">
                Locked
              </span>
            </div>
          </section>

          <section className="rounded-card border border-line bg-paper p-6">
            <h2 className="text-[15px] font-semibold text-ink">Defaults</h2>
            <p className="mb-4 mt-1 text-[12.5px] text-ink-muted">
              Applied to new members and records.
            </p>
            <div className="flex flex-col gap-3">
              <Field label="Timezone">
                <div className="relative rounded-[9px] border border-line-strong bg-panel">
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    disabled={readOnly}
                    aria-label="Timezone"
                    className={selectCls}
                  >
                    <option value="">—</option>
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className={chevCls}
                    strokeWidth={2}
                    aria-hidden
                  />
                </div>
              </Field>
              <Field label="Fiscal year start">
                <div className="relative rounded-[9px] border border-line-strong bg-panel">
                  <select
                    value={fiscalMonth}
                    onChange={(e) => setFiscalMonth(Number(e.target.value))}
                    disabled={readOnly}
                    aria-label="Fiscal year start"
                    className={selectCls}
                  >
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className={chevCls}
                    strokeWidth={2}
                    aria-hidden
                  />
                </div>
              </Field>
              <Field label="Default role for new members">
                <div className="relative rounded-[9px] border border-line-strong bg-panel">
                  <select
                    value={defaultRole}
                    onChange={(e) => setDefaultRole(e.target.value)}
                    disabled={readOnly}
                    aria-label="Default role for new members"
                    className={selectCls}
                  >
                    <option value="">—</option>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className={chevCls}
                    strokeWidth={2}
                    aria-hidden
                  />
                </div>
              </Field>
            </div>
            {isAdmin && (
              <div className="mt-4 flex justify-end">
                <SaveButton
                  pending={pending}
                  onClick={() =>
                    run(
                      () =>
                        updateOrgDefaults({
                          timezone: timezone || null,
                          fiscalYearStartMonth: fiscalMonth,
                          defaultMemberRole: defaultRole || null,
                        }),
                      "Defaults saved.",
                    )
                  }
                >
                  Save defaults
                </SaveButton>
              </div>
            )}
          </section>
        </div>

        {/* Modules (signature artifact) */}
        <section className="overflow-hidden rounded-card border border-line bg-paper">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-4 pt-[22px]">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">Modules</h2>
              <p className="mt-1 text-[12.5px] text-ink-muted">
                Enable or disable modules for the whole workspace.
              </p>
            </div>
            <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted">
              {enabledCount} / {settings.totalModules} ENABLED
            </span>
          </div>
          <div className="grid grid-cols-[2fr_1fr_auto] gap-3 border-t border-line px-6 py-2.5 font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted">
            <span>Module</span>
            <span>Group</span>
            <span className="text-right">Enabled</span>
          </div>
          {settings.moduleGroups.flatMap((g) =>
            g.modules.map((m) => {
              const on = enabled.has(m.key);
              return (
                <div
                  key={m.key}
                  className="grid grid-cols-[2fr_1fr_auto] items-center gap-3 border-t border-line px-6 py-3"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      aria-hidden
                      className={`h-[7px] w-[7px] flex-none rounded-[2px] ${on ? "bg-success" : "bg-line-strong"}`}
                    />
                    <span className="min-w-0 truncate text-[13.5px] font-semibold text-ink">
                      {m.name}
                    </span>
                  </div>
                  <span className="font-mono text-[10.5px] text-ink-muted">
                    {g.label}
                  </span>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-label={`${m.name} enabled`}
                      disabled={readOnly}
                      onClick={() => toggle(m.key)}
                      className={`relative h-[19px] w-[34px] flex-none rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60 ${
                        on ? "bg-accent" : "bg-line-strong"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-[15px] w-[15px] rounded-full transition-all ${
                          on ? "left-[17px] bg-ink-strong" : "left-0.5 bg-paper"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            }),
          )}
          {isAdmin && (
            <div className="flex items-center justify-end gap-3 border-t border-line px-6 py-4">
              <span className="mr-auto text-[12px] text-ink-muted">
                Core stays on so the workspace is always usable.
              </span>
              <SaveButton
                pending={pending}
                onClick={() =>
                  run(() => setEnabledModules([...enabled]), "Modules updated.")
                }
              >
                Save modules
              </SaveButton>
            </div>
          )}
        </section>
      </div>
    </SettingsShell>
  );
}

const inputCls =
  "w-full rounded-[9px] border border-line-strong bg-panel px-[13px] py-2.5 text-[13.5px] text-ink outline-none focus-visible:border-ink-strong focus-visible:ring-[3px] focus-visible:ring-accent disabled:opacity-70";
const selectCls =
  "w-full cursor-pointer appearance-none rounded-[9px] border-none bg-transparent py-2.5 pl-[13px] pr-[34px] text-[13.5px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-70";
const chevCls =
  "pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint";

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[12px] font-semibold text-ink">
        {label}
      </label>
      {children}
    </div>
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
