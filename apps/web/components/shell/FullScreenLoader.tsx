// UX.8 — branded cold-boot loader, 1:1 to design/prototypes/axona-v2/Loading.dc.html.
// The axona wordmark + asymmetric square glyph rising in (ax-rise), a sliding load
// bar (ax-load), and the "Waking the agents" mono label — over the signature dotted
// grid. Used as the root app/loading.tsx (pre-shell cold load) and as a Suspense
// fallback for heavy async boundaries. Honors prefers-reduced-motion (static, dimmed
// bar; no motion). v2 tokens only — no literal hex, no emoji. Server component.

const LOADER_CSS = `
@keyframes ax-rise{0%{opacity:0;transform:translateY(6px)}100%{opacity:1;transform:translateY(0)}}
@keyframes ax-load{0%{transform:translateX(-110%)}100%{transform:translateX(360%)}}
.ax-word{animation:ax-rise .6s ease .15s both}
.ax-sub{animation:ax-rise .6s ease .3s both}
.ax-bar{overflow:hidden}
.ax-bar>span{display:block;height:100%;width:38%;background:var(--ink-strong);border-radius:999px;animation:ax-load 1.5s cubic-bezier(.5,0,.2,1) infinite}
@media (prefers-reduced-motion:reduce){
  .ax-word,.ax-sub{animation:none;opacity:1;transform:none}
  .ax-bar>span{animation:none;transform:none;width:100%;opacity:.5}
}
`;

export function FullScreenLoader() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading Axona"
      className="bg-dotted-grid flex min-h-dvh flex-col items-center justify-center gap-[26px] bg-paper text-ink"
    >
      <style>{LOADER_CSS}</style>

      {/* wordmark + asymmetric square mark */}
      <div className="ax-word flex items-center gap-[9px]">
        <span className="text-[26px] font-bold tracking-[-0.045em] text-ink-strong">
          axona
        </span>
        <span
          aria-hidden
          className="h-[14px] w-[14px] bg-ink-strong"
          style={{ borderRadius: "0 8px 0 8px" }}
        />
      </div>

      {/* progress bar + label */}
      <div className="ax-sub flex flex-col items-center gap-[14px]">
        <div className="ax-bar h-[3px] w-[150px] rounded-pill bg-line-strong">
          <span />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
          Waking the agents
        </span>
      </div>
    </div>
  );
}
