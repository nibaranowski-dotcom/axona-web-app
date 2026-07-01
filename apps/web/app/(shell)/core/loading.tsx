// Loading skeleton for /core — mirrors the Command Center layout (KPI strip +
// exception feed + module grid) with hairline placeholder surfaces.
export default function CommandCenterLoading() {
  return (
    <div
      aria-hidden
      className="mx-auto flex max-w-[1100px] animate-pulse flex-col gap-8 px-6 py-6"
    >
      <div className="h-7 w-48 rounded-btn bg-panel-2" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-[68px] rounded-card border border-line-panel bg-panel"
          />
        ))}
      </div>
      <div className="h-64 rounded-card border border-line-strong bg-panel" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-[92px] rounded-card border border-line-panel bg-panel"
          />
        ))}
      </div>
    </div>
  );
}
