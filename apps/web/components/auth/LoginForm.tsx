"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { AlertTriangle, Eye, EyeOff, Lock } from "lucide-react";

// AUTH.1 — the login card (1:1 with Login.dc.html): axona mark + "Sign in to your
// workspace", an ink error banner on failure, Work email + Password (with a
// show/hide eye), a stubbed "Forgot password?" (AUTH.7), the primary Log in, an
// "or" divider, a DISABLED "Continue with SSO" (AUTH.2), and a footer link to
// signup. On submit → Auth.js signIn("credentials"); success → ?next or /. v2
// tokens only, no invented reds (the error state is ink).
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!res || res.error) {
        setError(true);
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const fieldBorder = error ? "border-ink-strong" : "border-line-strong";

  return (
    <main
      id="main"
      aria-label="Sign in"
      className="flex min-h-dvh items-start justify-center bg-panel px-8 py-12 font-sans text-ink"
      style={{ paddingTop: "clamp(48px, 12vh, 140px)" }}
    >
      <div className="flex w-full max-w-[460px] flex-col gap-3">
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
            <div className="mb-[30px] flex flex-col items-center gap-3.5">
              <span
                aria-hidden
                className="h-[34px] w-[34px] bg-ink-strong"
                style={{ borderRadius: "0 10px 0 10px" }}
              />
              <span className="text-[25px] font-bold tracking-[-0.045em] text-ink-strong">
                axona
              </span>
              <h1 className="text-center text-[13.5px] font-normal text-ink-muted">
                Sign in to your workspace
              </h1>
            </div>

            {/* error banner (ink — never red) */}
            {error && (
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
                    Sign-in failed
                  </div>
                  <span className="text-[12.5px] font-medium text-on-dark">
                    That email or password doesn’t match.
                  </span>
                </div>
              </div>
            )}

            <form onSubmit={onSubmit} noValidate>
              {/* email */}
              <div className="mb-3.5">
                <label
                  htmlFor="login-email"
                  className="mb-1.5 block text-[12px] font-semibold text-ink"
                >
                  Work email
                </label>
                <div
                  className={`flex items-center rounded-[9px] border bg-paper px-[13px] transition-colors focus-within:border-ink-strong focus-within:ring-[3px] focus-within:ring-accent ${fieldBorder}`}
                >
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="min-w-0 flex-1 border-none bg-transparent py-[11px] text-[13.5px] text-ink outline-none placeholder:text-ink-muted"
                  />
                </div>
              </div>

              {/* password */}
              <div className="mb-2">
                <label
                  htmlFor="login-password"
                  className="mb-1.5 block text-[12px] font-semibold text-ink"
                >
                  Password
                </label>
                <div
                  className={`flex items-center gap-2.5 rounded-[9px] border bg-paper px-[13px] transition-colors focus-within:border-ink-strong focus-within:ring-[3px] focus-within:ring-accent ${fieldBorder}`}
                >
                  <input
                    id="login-password"
                    type={showPw ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
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

              <div className="mb-5 flex justify-end">
                <a
                  href="/reset"
                  className="text-[12px] text-ink-muted transition-opacity hover:opacity-60"
                >
                  Forgot password?
                </a>
              </div>

              {/* primary */}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-[9px] bg-ink-strong py-[13px] text-[14px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
              >
                {busy ? "Signing in…" : "Log in"}
              </button>
            </form>

            {/* divider */}
            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint">
                or
              </span>
              <span className="h-px flex-1 bg-line" />
            </div>

            {/* SSO — present but disabled (AUTH.2) */}
            <button
              type="button"
              disabled
              title="SSO lands in AUTH.2"
              className="flex w-full cursor-not-allowed items-center justify-center gap-2.5 rounded-[9px] border border-line-strong bg-paper py-3 text-[13.5px] font-semibold text-ink opacity-60"
            >
              <Lock className="h-4 w-4" strokeWidth={1.8} aria-hidden />
              Continue with SSO
            </button>
          </div>

          {/* footer strip */}
          <div className="relative flex items-center justify-between border-t border-line bg-paper px-11 py-[15px]">
            <span className="text-[12.5px] text-ink-muted">
              New here?{" "}
              <a
                href="/signup"
                className="font-semibold text-ink transition-opacity hover:opacity-60"
              >
                Create a workspace
              </a>
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.05em] text-ink-faint">
              <Lock className="h-3 w-3" strokeWidth={2} aria-hidden />
              SOC 2 · SSO
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
