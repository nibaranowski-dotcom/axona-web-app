import type { FleetRollup } from "@/lib/fleet";

// Firmware / OTA panel (Fleet.dc.html) — the latest-version rollout progress +
// the OTA version spread (older versions flagged "old"), and the OTA agent note.
export function FirmwarePanel({ rollup }: { rollup: FleetRollup }) {
  const latest = rollup.firmware[0];
  const total = rollup.total || 1;
  const onLatest = latest?.count ?? 0;
  const pct = Math.round((onLatest / total) * 100);
  const behind = rollup.total - onLatest;

  return (
    <div className="flex flex-col rounded-card border border-line bg-paper p-5">
      <div className="mb-[14px] flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">Firmware</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          OTA
        </span>
      </div>
      <div className="mb-1.5 text-[12.5px] text-ink-muted">
        {latest?.version ?? "—"} rollout
      </div>
      <div className="mb-[14px] flex items-center gap-[10px]">
        <div className="h-[6px] flex-1 overflow-hidden rounded-pill bg-[var(--skeleton)]">
          <span
            className="block h-[6px] rounded-pill bg-accent"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-mono text-[11px] text-ink-muted">
          {onLatest} / {rollup.total}
        </span>
      </div>
      {rollup.firmware.map((v) => (
        <div
          key={v.version}
          className="flex items-center justify-between border-t border-line py-[7px] text-[12.5px]"
        >
          <span className="font-mono text-[12px] text-ink">
            {v.version}
            {latest && v.version !== latest.version && (
              <span className="ml-[7px] rounded-[4px] bg-accent px-[5px] py-px font-mono text-[9px] uppercase tracking-[0.04em] text-accent-ink">
                old
              </span>
            )}
          </span>
          <span className="text-ink-muted">
            {v.count} unit{v.count === 1 ? "" : "s"}
          </span>
        </div>
      ))}
      {behind > 0 && (
        <div className="mt-[13px] flex items-start gap-2 border-t border-line pt-3">
          <span
            aria-hidden
            className="mt-[5px] h-1.5 w-1.5 flex-none rounded-pill bg-accent"
          />
          <span className="text-[12px] leading-[1.4] text-ink-muted">
            OTA agent staging {latest?.version} to the last {behind} unit
            {behind === 1 ? "" : "s"}.
          </span>
        </div>
      )}
    </div>
  );
}
