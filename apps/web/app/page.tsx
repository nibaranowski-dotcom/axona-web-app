import { StatusBadge } from "@/components/data/StatusBadge";

const surfaces = [
  ["paper", "bg-paper border border-line"],
  ["panel", "bg-panel"],
  ["panel-2", "bg-panel-2"],
  ["skeleton", "bg-skeleton"],
] as const;

// FND.2 token showcase. Real Mission Control lands in MC.1; app shell in FND.13.
export default function Page() {
  return (
    <main className="min-h-dvh bg-paper text-ink">
      <header className="bg-dotted-grid border-b border-line">
        <div className="mx-auto max-w-5xl px-8 py-12">
          <p className="font-mono text-[11px] uppercase tracking-widest text-ink-faint">
            Axona — operating system for robotics companies
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-strong">
            Design tokens wired
          </h1>
          <p className="mt-2 max-w-xl text-ink-muted">
            FND.2 — v2 tokens mapped 1:1 into Tailwind; Archivo + JetBrains Mono
            self-hosted via next/font.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-8 py-10">
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-ink-faint">
          StatusBadge
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <StatusBadge tone="live">Live</StatusBadge>
          <StatusBadge tone="active">Working</StatusBadge>
          <StatusBadge tone="critical">Critical</StatusBadge>
          <StatusBadge tone="neutral">Offline</StatusBadge>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-btn bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
          >
            Primary action
          </button>
          <button
            type="button"
            className="rounded-btn border border-line-strong bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-panel"
          >
            Secondary
          </button>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {surfaces.map(([name, cls]) => (
            <div key={name} className={`rounded-card p-4 ${cls}`}>
              <div className="font-mono text-[11px] text-ink-muted">{name}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
