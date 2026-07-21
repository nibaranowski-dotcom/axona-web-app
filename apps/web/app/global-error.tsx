"use client";

import { useEffect } from "react";
import "@axona/config/styles/tokens.css";
import "./globals.css";
import { archivo, jetbrainsMono } from "./fonts";

// LOGIN.1 — the top-level error boundary. `global-error.tsx` REPLACES the root
// layout when a route (or the root layout itself) throws, so it renders its own
// <html>/<body>. Its whole reason to exist: no route — /login first and foremost
// — can ever surface a raw 500. Any unhandled throw during a render lands here and
// shows the designed, branded error state (ink + accent, no invented red), with a
// retry that re-renders the failed segment. In dev, Next still shows its overlay;
// this is the production-facing guarantee.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("global error boundary:", error);
  }, [error]);

  return (
    <html lang="en" className={`${archivo.variable} ${jetbrainsMono.variable}`}>
      <body>
        <main
          id="main"
          aria-label="Something went wrong"
          className="grid min-h-dvh place-items-center bg-panel font-sans text-ink"
        >
          <div className="max-w-[440px] px-8 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint">
              Error
            </p>
            <h1 className="mt-2 text-xl font-semibold text-ink-strong">
              Something went wrong
            </h1>
            <p className="mt-2 text-[13.5px] leading-[1.5] text-ink-muted">
              An unexpected error interrupted this page. Try again — if it keeps
              happening, refresh the app.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-5 rounded-btn bg-ink-strong px-4 py-2 text-[13.5px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
