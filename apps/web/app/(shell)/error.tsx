"use client";

import { useEffect } from "react";

// Error boundary for the shell segment — e.g. the nav fetch failing. Keeps the
// page usable with a retry rather than a blank screen.
export default function ShellError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("shell nav error:", error);
  }, [error]);

  return (
    <div className="grid h-dvh place-items-center bg-paper text-ink">
      <div className="max-w-md px-8 text-center">
        <p className="font-mono text-[11px] uppercase tracking-widest text-ink-faint">
          Navigation
        </p>
        <h1 className="mt-2 text-xl font-semibold text-ink-strong">
          Couldn&apos;t load navigation
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          The module list failed to load. Check that the database is up and
          seeded, then retry.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-btn bg-accent px-4 py-2 text-sm font-medium text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-strong"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
