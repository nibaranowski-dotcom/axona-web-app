// UX.8 — in-shell loading skeleton, 1:1 to design/prototypes/axona-v2/Loading
// Skeleton.dc.html. A skeleton of the REAL shell — 240px sidebar · 60px topbar ·
// main (stat strip · hero card · table) · 360px right pane — with pulsing .sk /
// .sk-soft blocks (sk-pulse 1.4s). Dimensions mirror the real shell so streamed
// content swaps in with NO layout shift. Honors prefers-reduced-motion (static,
// dimmed; no motion). v2 tokens only — no literal hex, no emoji. Server component.
//
// variant="main" (used by app/(shell)/loading.tsx) renders ONLY the main column —
// on a client-side route transition the shell layout (sidebar + agent pane) PERSISTS
// and this fallback fills the <main> slot, so skeletonizing the whole shell would
// double the sidebar/pane and cause a jump. variant="shell" (default) is the full
// design 1:1 (sidebar + main + pane) for when the whole shell is absent.

const SKELETON_CSS = `
@keyframes sk-pulse{0%,100%{opacity:1}50%{opacity:.45}}
.sk{background:var(--skeleton);border-radius:7px;animation:sk-pulse 1.4s ease-in-out infinite}
.sk-soft{background:var(--panel-2);border-radius:8px;animation:sk-pulse 1.4s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.sk,.sk-soft{animation:none;opacity:.8}}
`;

// Placeholder shapes mirroring the design's seed values.
const NAV_GROUPS = [
  ["62%", "48%", "70%", "54%", "58%"],
  ["66%", "52%", "44%", "72%"],
  ["50%", "60%", "46%"],
];
const HERO_BARS = ["46%", "62%", "38%", "54%"];

// The center column: 60px topbar + stat strip · hero card · table card. This is the
// part that actually swaps on a route transition (matches the real <main>).
function MainColumn() {
  return (
    <div className="flex min-w-0 flex-1 flex-col bg-panel">
      {/* topbar — 60px, matches ScreenShell */}
      <div className="flex h-[60px] flex-none items-center justify-between border-b border-line bg-paper px-6">
        <div className="flex flex-col gap-[7px]">
          <span className="sk h-[9px] w-[120px]" />
          <span className="sk h-[15px] w-[190px]" />
        </div>
        <div className="flex gap-[10px]">
          <span className="sk h-[32px] w-[110px] rounded-[8px]" />
          <span className="sk-soft h-[32px] w-[120px] rounded-[8px]" />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-[18px] overflow-hidden px-6 py-[22px]">
        {/* stat strip */}
        <div className="flex overflow-hidden rounded-[14px] border border-line bg-paper">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`flex flex-1 flex-col gap-[9px] px-[18px] py-4 ${i > 0 ? "border-l border-line" : ""}`}
            >
              <span className="sk h-[20px] w-[64px]" />
              <span className="sk h-[9px] w-[88px]" />
            </div>
          ))}
        </div>
        {/* hero card */}
        <div className="flex flex-col gap-[14px] rounded-[14px] border border-line bg-paper p-5">
          <div className="flex justify-between">
            <span className="sk h-[14px] w-[180px]" />
            <span className="sk h-[12px] w-[90px]" />
          </div>
          {HERO_BARS.map((w, i) => (
            <div key={i} className="flex flex-col gap-[7px]">
              <span className="sk h-[10px]" style={{ width: w }} />
              <span className="sk-soft h-[9px] w-full rounded-pill" />
            </div>
          ))}
        </div>
        {/* table card */}
        <div className="flex flex-1 flex-col rounded-[14px] border border-line bg-paper px-5 py-[18px]">
          <span className="sk mb-4 h-[14px] w-[150px]" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-t border-line py-[13px]"
            >
              <span className="sk h-[30px] w-[30px] flex-none rounded-[8px]" />
              <span className="sk h-[11px] flex-[2]" />
              <span className="sk h-[11px] flex-1" />
              <span className="sk h-[11px] flex-1" />
              <span className="sk-soft h-[20px] w-[76px] flex-none rounded-pill" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ScreenSkeleton({
  variant = "shell",
}: {
  variant?: "shell" | "main";
}) {
  // Route-transition fallback: the persisted shell wraps this — skeletonize only
  // the main column (no doubled sidebar/pane, no layout shift).
  if (variant === "main") {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading"
        className="flex h-full min-h-0 flex-col"
      >
        <style>{SKELETON_CSS}</style>
        <MainColumn />
      </div>
    );
  }

  // Full shell (1:1 design): sidebar · main · right pane.
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className="flex h-dvh overflow-hidden bg-panel"
    >
      <style>{SKELETON_CSS}</style>

      {/* sidebar skeleton — 240px, matches the real Sidebar */}
      <aside
        aria-hidden
        className="flex w-[240px] flex-none flex-col border-r border-line bg-paper px-[14px] py-[18px]"
      >
        <div className="flex items-center gap-2 px-2 pb-[18px] pt-1">
          <span className="text-[21px] font-bold tracking-[-0.04em] text-ink-strong">
            axona
          </span>
          <span
            className="h-3 w-3 bg-ink-strong"
            style={{ borderRadius: "0 7px 0 7px" }}
          />
        </div>
        <div className="sk-soft mx-1 mb-4 h-[38px]" />
        {NAV_GROUPS.map((rows, gi) => (
          <div key={gi}>
            <div className="sk mx-[10px] mb-[10px] mt-4 h-[9px] w-[78px]" />
            {rows.map((w, ri) => (
              <div
                key={ri}
                className="flex items-center gap-[11px] px-[10px] py-[9px]"
              >
                <span className="sk h-[6px] w-[6px] flex-none rounded-[2px]" />
                <span className="sk h-[11px]" style={{ width: w }} />
              </div>
            ))}
          </div>
        ))}
        <div className="mt-auto flex items-center gap-[10px] border-t border-line px-2 pb-0.5 pt-3">
          <span className="sk h-[28px] w-[28px] flex-none rounded-full" />
          <div className="flex flex-1 flex-col gap-[5px]">
            <span className="sk h-[10px] w-[70%]" />
            <span className="sk h-[8px] w-[45%]" />
          </div>
        </div>
      </aside>

      {/* main column skeleton */}
      <MainColumn />

      {/* agent pane skeleton — 360px */}
      <div
        aria-hidden
        className="flex w-[360px] flex-none flex-col border-l border-line bg-paper"
      >
        <div className="flex h-[60px] flex-none items-center gap-3 border-b border-line px-[18px]">
          <span className="sk h-[30px] w-[30px] flex-none rounded-full" />
          <div className="flex flex-1 flex-col gap-[6px]">
            <span className="sk h-[12px] w-[60%]" />
            <span className="sk h-[8px] w-[40%]" />
          </div>
        </div>
        <div className="flex gap-[10px] border-b border-line px-[18px] py-[14px]">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className="sk h-[22px] w-[22px] flex-none rounded-full"
            />
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-4 p-[18px]">
          <div className="flex gap-[9px]">
            <span className="sk h-[22px] w-[22px] flex-none rounded-full" />
            <span className="sk-soft h-[56px] w-[80%] rounded-[13px]" />
          </div>
          <div className="flex justify-end">
            <span className="sk h-[38px] w-[60%] rounded-[13px]" />
          </div>
          <div className="flex gap-[9px]">
            <span className="sk h-[22px] w-[22px] flex-none rounded-full" />
            <span className="sk-soft h-[44px] w-[70%] rounded-[13px]" />
          </div>
        </div>
        <div className="border-t border-line px-[18px] pb-4 pt-3">
          <span className="sk-soft block h-[42px] rounded-[10px]" />
        </div>
      </div>
    </div>
  );
}
