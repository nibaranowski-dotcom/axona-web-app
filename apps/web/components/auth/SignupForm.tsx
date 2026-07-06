"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { AlertTriangle, Check, ChevronDown, Eye, EyeOff } from "lucide-react";
import { signupAction, type SignupState } from "@/app/signup/actions";
import { VERTICALS } from "@/lib/provisioning";

// AUTH.4 — the signup card (1:1 with Signup.dc.html): "Your account" (Full name,
// Work email, Password) + "Your workspace" (Organization name, live-suggested
// Workspace URL slug, Vertical select), a "Free while in pilot · no card required"
// reassurance line, the primary Create workspace, and a link to /login. Field
// errors render as an ink banner (no invented reds). Submits via the server
// provisioning action (useActionState); on success the action redirects.
export function SignupForm() {
  const [state, formAction] = useFormState<SignupState, FormData>(
    signupAction,
    {},
  );
  const [orgName, setOrgName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // Live-suggest the workspace URL from the org name until the user edits it.
  useEffect(() => {
    if (slugEdited) return;
    setSlug(kebab(orgName));
  }, [orgName, slugEdited]);

  const err = state.error;
  const emailErr = err?.field === "email";

  return (
    <main
      aria-label="Create workspace"
      className="flex min-h-dvh items-start justify-center bg-panel px-8 py-12 font-sans text-ink"
      style={{ paddingTop: "clamp(40px, 8vh, 96px)" }}
    >
      <div className="flex w-full max-w-[480px] flex-col gap-3">
        <div
          className="relative overflow-hidden rounded-[20px] border border-line"
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
                "linear-gradient(180deg, rgba(244,243,239,0) 0%, rgba(244,243,239,.55) 100%)",
            }}
          />
          <div className="relative px-11 pb-[30px] pt-11">
            {/* mark + wordmark */}
            <div className="mb-7 flex flex-col items-center gap-3.5">
              <span
                aria-hidden
                className="h-[34px] w-[34px] bg-ink-strong"
                style={{ borderRadius: "0 10px 0 10px" }}
              />
              <span className="text-[25px] font-bold tracking-[-0.045em] text-ink-strong">
                axona
              </span>
              <h1 className="text-center text-[13.5px] font-normal text-ink-muted">
                Create your workspace
              </h1>
            </div>

            {err && (
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
                    Couldn’t create workspace
                  </div>
                  <span className="text-[12.5px] font-medium text-on-dark">
                    {err.message}
                  </span>
                </div>
              </div>
            )}

            <form action={formAction} noValidate>
              {/* Your account */}
              <SectionLabel>Your account</SectionLabel>
              <Field label="Full name" htmlFor="su-name">
                <input
                  id="su-name"
                  name="name"
                  autoComplete="name"
                  required
                  placeholder="Ada Lovelace"
                  className={inputCls}
                />
              </Field>
              <Field label="Work email" htmlFor="su-email" invalid={emailErr}>
                <input
                  id="su-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@company.com"
                  className={inputCls}
                />
              </Field>
              <Field label="Password" htmlFor="su-password">
                <input
                  id="su-password"
                  name="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  className={`${inputCls} tracking-[0.12em] placeholder:tracking-normal`}
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
              </Field>

              {/* Your workspace */}
              <div className="mt-5">
                <SectionLabel>Your workspace</SectionLabel>
              </div>
              <Field label="Organization name" htmlFor="su-org">
                <input
                  id="su-org"
                  name="orgName"
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Acme Robotics"
                  className={inputCls}
                />
              </Field>

              {/* Workspace URL — live-suggested slug */}
              <div className="mb-3.5">
                <label
                  htmlFor="su-slug"
                  className="mb-1.5 block text-[12px] font-semibold text-ink"
                >
                  Workspace URL
                </label>
                <div className="flex items-center rounded-[9px] border border-line-strong bg-panel px-[13px] transition-colors focus-within:border-ink-strong focus-within:ring-[3px] focus-within:ring-accent">
                  <span className="font-mono text-[13px] text-ink-faint">
                    axona.co/
                  </span>
                  <input
                    id="su-slug"
                    value={slug}
                    onChange={(e) => {
                      setSlugEdited(true);
                      setSlug(kebab(e.target.value));
                    }}
                    className="min-w-0 flex-1 border-none bg-transparent py-[11px] font-mono text-[13px] text-ink outline-none"
                  />
                  {slug && (
                    <Check
                      className="h-[15px] w-[15px] flex-none text-success"
                      strokeWidth={2.4}
                      aria-hidden
                    />
                  )}
                </div>
                <div className="mt-[7px] text-[11.5px] text-ink-faint">
                  Auto-suggested from your organization name.
                </div>
              </div>

              {/* Vertical */}
              <div className="mb-1">
                <label
                  htmlFor="su-industry"
                  className="mb-1.5 block text-[12px] font-semibold text-ink"
                >
                  Vertical
                </label>
                <div className="relative rounded-[9px] border border-line-strong bg-panel">
                  <select
                    id="su-industry"
                    name="industry"
                    defaultValue={VERTICALS[0]}
                    className="w-full cursor-pointer appearance-none border-none bg-transparent py-[11px] pl-[13px] pr-[38px] text-[13.5px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {VERTICALS.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-[13px] top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-ink-faint"
                    strokeWidth={2}
                    aria-hidden
                  />
                </div>
                <div className="mt-[7px] text-[11.5px] text-ink-faint">
                  Tailors your modules and starter workflows.
                </div>
              </div>

              <SubmitButton />

              <p className="mt-3 text-center text-[11.5px] text-ink-muted">
                Free while in pilot · no card required
              </p>
            </form>
          </div>

          <div className="relative border-t border-line bg-paper px-11 py-[15px] text-center">
            <span className="text-[12.5px] text-ink-muted">
              Already have a workspace?{" "}
              <a
                href="/login"
                className="font-semibold text-ink transition-opacity hover:opacity-60"
              >
                Log in
              </a>
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}

// The submit button reads the form's pending state (useFormStatus must render
// inside the <form>).
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-5 w-full rounded-[9px] bg-ink-strong py-[13px] text-[14px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
    >
      {pending ? "Creating workspace…" : "Create workspace"}
    </button>
  );
}

const inputCls =
  "min-w-0 flex-1 border-none bg-transparent py-[11px] text-[13.5px] text-ink outline-none placeholder:text-ink-muted";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint">
      {children}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  invalid = false,
  children,
}: {
  label: string;
  htmlFor: string;
  invalid?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3.5">
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[12px] font-semibold text-ink"
      >
        {label}
      </label>
      <div
        className={`flex items-center gap-2.5 rounded-[9px] border bg-paper px-[13px] transition-colors focus-within:border-ink-strong focus-within:ring-[3px] focus-within:ring-accent ${
          invalid ? "border-ink-strong" : "border-line-strong"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

// kebab-case a slug fragment as the user types (allow trailing dash while typing).
function kebab(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 48);
}
