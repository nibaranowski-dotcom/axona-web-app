"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from "lucide-react";
import { saveProfile, finishOnboarding } from "@/app/onboarding/actions";
import { ONBOARDING_GROUPS, DEFAULT_ENABLED } from "@/lib/onboarding";
import { VERTICALS } from "@/lib/provisioning";

// AUTH.6 — the 3-step onboarding wizard (1:1 with Onboarding.dc.html): a top
// stepper (1 Profile · 2 Team · 3 Modules), a step body, and a footer (Back ·
// dots · Next/Finish). Step 1 saves the org profile; step 2 collects teammates
// (skip-first, NO live invites — that's AUTH.5); step 3 toggles modules; Finish
// persists enabledModules + onboardedAt and lands on the Command Center. v2 tokens,
// Lucide icons, no emoji, no invented reds.
type Role =
  | "ADMIN"
  | "OPS"
  | "ENGINEER"
  | "SALES"
  | "FINANCE"
  | "TECH"
  | "VIEWER";
const ROLES: Role[] = [
  "ADMIN",
  "OPS",
  "ENGINEER",
  "SALES",
  "FINANCE",
  "TECH",
  "VIEWER",
];

interface Invite {
  email: string;
  role: Role;
}

export function OnboardingWizard({
  orgName,
  orgIndustry,
}: {
  orgName: string;
  orgIndustry: string | null;
}) {
  const [step, setStep] = useState(0); // 0 Profile · 1 Team · 2 Modules
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState(orgName);
  const [industry, setIndustry] = useState(orgIndustry ?? VERTICALS[0]);
  const [invites, setInvites] = useState<Invite[]>([
    { email: "", role: "OPS" },
  ]);
  const [enabled, setEnabled] = useState<Set<string>>(
    () => new Set(DEFAULT_ENABLED),
  );

  const steps = ["Profile", "Team", "Modules"] as const;

  const toggle = (key: string) =>
    setEnabled((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const next = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (step === 0) {
        await saveProfile({ name, industry });
        setStep(1);
      } else if (step === 1) {
        // Team is collect-only (AUTH.5 wires real invites). Advance.
        setStep(2);
      } else {
        await finishOnboarding([...enabled]); // redirects to /core on success
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="relative flex min-h-dvh flex-col font-sans text-ink"
      style={{
        backgroundColor: "var(--paper)",
        backgroundImage:
          "radial-gradient(var(--line-strong) 1.1px, transparent 1.1px)",
        backgroundSize: "18px 18px",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(244,243,239,0), rgba(244,243,239,.45))",
        }}
      />

      {/* top bar: wordmark + stepper */}
      <header className="relative flex items-center justify-between gap-5 border-b border-line bg-paper/75 px-[34px] py-5 backdrop-blur">
        <div className="flex flex-none items-center gap-2.5">
          <span
            aria-hidden
            className="h-6 w-6 bg-ink-strong"
            style={{ borderRadius: "0 8px 0 8px" }}
          />
          <span className="text-[19px] font-bold tracking-[-0.045em] text-ink-strong">
            axona
          </span>
        </div>
        <ol className="flex items-center gap-1.5">
          {steps.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={label} className="flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-2 rounded-pill border px-[13px] py-1.5 ${
                    active
                      ? "border-line-strong bg-panel"
                      : "border-transparent bg-transparent"
                  }`}
                >
                  <span
                    className={`inline-flex h-[19px] w-[19px] items-center justify-center rounded-full font-mono text-[10px] font-bold ${
                      active
                        ? "bg-ink-strong text-on-dark"
                        : done
                          ? "bg-accent text-accent-ink"
                          : "bg-panel-2 text-ink-faint"
                    }`}
                  >
                    {done ? (
                      <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span
                    className={`text-[12.5px] font-semibold ${
                      active || done ? "text-ink" : "text-ink-faint"
                    }`}
                  >
                    {label}
                  </span>
                </span>
                {i < steps.length - 1 && (
                  <span aria-hidden className="h-px w-[22px] bg-line-strong" />
                )}
              </li>
            );
          })}
        </ol>
        <span className="flex-none text-[12.5px] text-ink-muted">
          {name || "New workspace"}
        </span>
      </header>

      {/* body */}
      <main
        aria-label={`Onboarding · step ${step + 1} of 3`}
        className="scarea relative flex flex-1 justify-center overflow-y-auto p-[34px]"
      >
        <div className="w-full max-w-[860px]">
          {step === 0 && (
            <ProfileStep
              name={name}
              setName={setName}
              industry={industry}
              setIndustry={setIndustry}
            />
          )}
          {step === 1 && (
            <TeamStep
              invites={invites}
              setInvites={setInvites}
              onSkip={() => setStep(2)}
            />
          )}
          {step === 2 && <ModulesStep enabled={enabled} toggle={toggle} />}
        </div>
      </main>

      {/* footer nav */}
      <footer className="relative flex items-center justify-between gap-4 border-t border-line bg-paper px-[34px] py-[18px]">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || busy}
          className="inline-flex items-center gap-1.5 rounded-[9px] border border-line-strong bg-paper px-5 py-[11px] text-[13.5px] font-semibold text-ink transition-colors hover:border-ink-strong hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
          Back
        </button>
        <div className="flex items-center gap-2" aria-hidden>
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-[7px] w-[7px] rounded-full ${
                i === step ? "bg-ink-strong" : "bg-line-strong"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => void next()}
          disabled={busy || (step === 0 && !name.trim())}
          className="inline-flex items-center gap-2.5 rounded-[9px] bg-ink-strong px-[22px] py-[11px] text-[13.5px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
        >
          {step === 2 ? (
            busy ? (
              "Finishing…"
            ) : (
              "Finish → Command Center"
            )
          ) : (
            <>
              Continue
              <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
            </>
          )}
        </button>
      </footer>
    </div>
  );
}

function StepHead({
  step,
  total,
  eyebrow,
  title,
  sub,
}: {
  step: number;
  total: number;
  eyebrow: string;
  title: string;
  sub: string;
}) {
  return (
    <div className="mb-[26px] text-center">
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint">
        Step {step} of {total} · {eyebrow}
      </div>
      <h1 className="mx-0 mb-1.5 mt-2.5 text-[clamp(22px,2.6vw,30px)] font-semibold tracking-[-0.03em]">
        {title}
      </h1>
      <p className="mx-auto max-w-[52ch] text-[14px] leading-[1.5] text-ink-muted">
        {sub}
      </p>
    </div>
  );
}

function ProfileStep({
  name,
  setName,
  industry,
  setIndustry,
}: {
  name: string;
  setName: (v: string) => void;
  industry: string;
  setIndustry: (v: string) => void;
}) {
  return (
    <div className="mx-auto max-w-[460px]">
      <StepHead
        step={1}
        total={3}
        eyebrow="Your profile"
        title="Set up your workspace."
        sub="Confirm the basics — you can change these anytime from settings."
      />
      <label
        htmlFor="ob-name"
        className="mb-1.5 block text-[12px] font-semibold text-ink"
      >
        Organization name
      </label>
      <div className="mb-4 rounded-[9px] border border-line-strong bg-paper px-[13px] transition-colors focus-within:border-ink-strong focus-within:ring-[3px] focus-within:ring-accent">
        <input
          id="ob-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Robotics"
          className="w-full border-none bg-transparent py-[11px] text-[13.5px] text-ink outline-none placeholder:text-ink-muted"
        />
      </div>
      <label
        htmlFor="ob-industry"
        className="mb-1.5 block text-[12px] font-semibold text-ink"
      >
        Vertical
      </label>
      <div className="relative rounded-[9px] border border-line-strong bg-paper">
        <select
          id="ob-industry"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          className="w-full cursor-pointer appearance-none border-none bg-transparent py-[11px] pl-[13px] pr-[38px] text-[13.5px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {VERTICALS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function TeamStep({
  invites,
  setInvites,
  onSkip,
}: {
  invites: Invite[];
  setInvites: (v: Invite[]) => void;
  onSkip: () => void;
}) {
  const update = (i: number, patch: Partial<Invite>) =>
    setInvites(invites.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  return (
    <div className="mx-auto max-w-[520px]">
      <StepHead
        step={2}
        total={3}
        eyebrow="Invite your team"
        title="Bring your team along."
        sub="Add teammates now or skip and invite them later — invites are sent from settings."
      />
      <div className="flex flex-col gap-2.5">
        {invites.map((r, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className="flex flex-1 items-center rounded-[9px] border border-line-strong bg-paper px-[13px] transition-colors focus-within:border-ink-strong focus-within:ring-[3px] focus-within:ring-accent">
              <input
                type="email"
                value={r.email}
                onChange={(e) => update(i, { email: e.target.value })}
                placeholder="teammate@company.com"
                aria-label={`Teammate ${i + 1} email`}
                className="w-full border-none bg-transparent py-[11px] text-[13px] text-ink outline-none placeholder:text-ink-muted"
              />
            </div>
            <div className="relative w-[150px] flex-none rounded-[9px] border border-line-strong bg-paper">
              <select
                value={r.role}
                onChange={(e) => update(i, { role: e.target.value as Role })}
                aria-label={`Teammate ${i + 1} role`}
                className="w-full cursor-pointer appearance-none border-none bg-transparent py-[11px] pl-[13px] pr-8 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setInvites(invites.filter((_, idx) => idx !== i))}
              disabled={invites.length === 1}
              aria-label={`Remove teammate ${i + 1}`}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-[9px] border border-line text-ink-muted transition-colors hover:border-ink-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
            >
              <Trash2
                className="h-[15px] w-[15px]"
                strokeWidth={1.8}
                aria-hidden
              />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setInvites([...invites, { email: "", role: "OPS" }])}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink transition-opacity hover:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          Add another
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="rounded-[9px] border border-line-strong bg-paper px-4 py-2 text-[12.5px] font-semibold text-ink-muted transition-colors hover:border-ink-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

function ModulesStep({
  enabled,
  toggle,
}: {
  enabled: Set<string>;
  toggle: (key: string) => void;
}) {
  return (
    <>
      <StepHead
        step={3}
        total={3}
        eyebrow="Enable modules"
        title="Turn on what you run."
        sub="Every module ships with agents. Start with the defaults — you can enable the rest anytime from the Command Center."
      />
      <div className="flex flex-col gap-[22px]">
        {ONBOARDING_GROUPS.map((g) => {
          const onCount = g.modules.filter((m) => enabled.has(m.key)).length;
          return (
            <div key={g.group}>
              <div className="mb-3 flex items-center gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint">
                  {g.label}
                </span>
                <span aria-hidden className="h-px flex-1 bg-line" />
                <span className="font-mono text-[10px] text-ink-faint">
                  {onCount} / {g.modules.length} on
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                {g.modules.map((m) => {
                  const on = enabled.has(m.key);
                  return (
                    <button
                      key={m.key}
                      type="button"
                      role="switch"
                      aria-checked={on}
                      onClick={() => toggle(m.key)}
                      className={`flex min-h-[78px] flex-col justify-between rounded-[12px] border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                        on
                          ? "border-ink-strong bg-paper"
                          : "border-line bg-panel hover:border-ink-strong"
                      }`}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-[13.5px] font-semibold leading-[1.25] tracking-[-0.01em]">
                          {m.name}
                        </span>
                        <span
                          aria-hidden
                          className={`relative h-[18px] w-8 flex-none rounded-full transition-colors ${
                            on ? "bg-accent" : "bg-line-strong"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all ${
                              on ? "left-4 bg-ink-strong" : "left-0.5 bg-paper"
                            }`}
                          />
                        </span>
                      </span>
                      <span
                        className={`font-mono text-[9px] tracking-[0.03em] ${
                          on ? "text-ink-muted" : "text-ink-faint"
                        }`}
                      >
                        {on ? "Enabled" : "Off"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
