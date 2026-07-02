import type { FirmwareRelease } from "@/lib/engineering";

// Firmware releases panel (Engineering.dc.html) — version + note + state badge.
// RC/RELEASED carried by a dot (lime = release candidate in flight · green =
// released) with ink text — AA-safe; brand palette only.
function stateMeta(state: string): { dot: string; label: string } {
  const s = state.toUpperCase();
  if (s === "RELEASED") return { dot: "bg-success", label: "Released" };
  if (s === "RC") return { dot: "bg-accent", label: "RC" };
  return { dot: "bg-line-strong", label: state };
}

export function FirmwareReleases({
  releases,
}: {
  releases: FirmwareRelease[];
}) {
  return (
    <section
      aria-label="Firmware releases"
      className="rounded-card border border-line bg-paper p-5"
    >
      <div className="mb-1.5 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">
          Firmware releases
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          HX platform
        </span>
      </div>
      {releases.length === 0 ? (
        <p className="border-t border-line pt-3 text-sm text-ink-muted">
          No firmware releases.
        </p>
      ) : (
        releases.map((r) => {
          const meta = stateMeta(r.state);
          return (
            <div
              key={r.id}
              className="flex items-center justify-between gap-[10px] border-t border-line py-3"
            >
              <div className="min-w-0">
                <div className="font-mono text-[13px] font-semibold text-ink">
                  {r.version}
                </div>
                <div className="mt-0.5 text-[11px] text-ink-muted">
                  {r.note}
                </div>
              </div>
              <span className="inline-flex flex-none items-center gap-1.5 text-[11px] font-semibold text-ink">
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 rounded-pill ${meta.dot}`}
                />
                {meta.label}
              </span>
            </div>
          );
        })
      )}
    </section>
  );
}
