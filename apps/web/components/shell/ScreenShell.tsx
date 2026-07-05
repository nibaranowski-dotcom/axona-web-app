import type { ReactNode } from "react";

// UX.4 — the shared module-screen scaffold. Every screen scrolls as ONE page via
// the shell's <main> (which is the single scroll container). Fixes the old
// double-scroll (a viewport-locked `flex h-full` View with a NESTED overflow-y-auto
// body) that trapped lower panels + the agent trace below the fold with no way to
// reach them.
//
//   - `min-h-full` (not h-full): the screen is AT LEAST the viewport height so
//     short screens still fill it, but it GROWS with content and <main> scrolls it.
//   - the 60px header is `sticky top-0`: the topbar stays put while the body scrolls.
//   - the body flows naturally (no flex-1 / min-h-0 / overflow-y-auto viewport-cap)
//     with `pb-16` bottom padding so the last panel/trace is never flush-cropped.
//
// The StatStrip (UX.1) is the first flowing child; the TraceConsole (shrink-0) is
// the last — it now renders in full at the end of the scroll. An inner element that
// legitimately needs its own scroll (a wide table's HORIZONTAL scroll) keeps it;
// this scaffold only removes the whole-screen VERTICAL viewport-cap.
export function ScreenShell({
  header,
  children,
  bodyClassName = "",
}: {
  header: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <div className="flex min-h-full flex-col bg-panel">
      <header className="sticky top-0 z-20 flex h-[60px] flex-none items-center justify-between border-b border-line bg-paper px-6">
        {header}
      </header>
      <div
        className={`flex flex-1 flex-col gap-[18px] px-6 pb-16 pt-[22px] ${bodyClassName}`}
      >
        {children}
      </div>
    </div>
  );
}

// A centered empty/error state that fills a reasonable height without a viewport
// lock (used in place of the old `flex-1 items-center justify-center`).
export function ScreenMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[55vh] flex-1 items-center justify-center px-6">
      {children}
    </div>
  );
}
