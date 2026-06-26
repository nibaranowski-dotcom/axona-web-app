import { TraceConsole } from "@/components/shell/TraceConsole";

// Landing at "/" — placeholder until MC.1 replaces it with the real Mission
// Control launcher (module grid + ⌘K hand-off).
// TODO MC.1: swap this for the Mission Control launcher.
export default function Page() {
  return (
    <div className="mx-auto max-w-3xl px-8 py-12">
      <p className="font-mono text-[11px] uppercase tracking-widest text-ink-muted">
        Mission Control
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-strong">
        Pick a module
      </h1>
      <p className="mt-2 max-w-xl text-ink-muted">
        Choose a module from the sidebar to get started. The Mission Control
        launcher (module grid + search hand-off) lands in MC.1.
      </p>

      <div className="mt-8">
        <TraceConsole />
      </div>
    </div>
  );
}
