import * as React from "react";

// AUTH.7 — the shared full-screen auth card (matches /login: dotted-grid panel,
// axona wordmark, tagline as the <h1>). Used by the reset + verify screens.
export function AuthCard({
  title,
  subtitle,
  ariaLabel,
  children,
}: {
  title: string;
  subtitle: string;
  ariaLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <main
      aria-label={ariaLabel}
      className="flex min-h-dvh items-start justify-center bg-panel px-8 py-12 font-sans text-ink"
      style={{ paddingTop: "clamp(48px, 12vh, 140px)" }}
    >
      <div className="w-full max-w-[440px]">
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
            <div className="mb-[26px] flex flex-col items-center gap-3">
              <span
                aria-hidden
                className="h-[34px] w-[34px] bg-ink-strong"
                style={{ borderRadius: "0 10px 0 10px" }}
              />
              <span className="text-[25px] font-bold tracking-[-0.045em] text-ink-strong">
                axona
              </span>
              <h1 className="text-center text-[13.5px] font-normal text-ink-muted">
                {subtitle}
              </h1>
            </div>
            <h2 className="mb-4 text-center text-[16px] font-semibold text-ink">
              {title}
            </h2>
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
