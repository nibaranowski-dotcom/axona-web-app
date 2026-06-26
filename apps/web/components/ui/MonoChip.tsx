import type { ReactNode } from "react";

// DS.1 MonoChip (components/core/StatChip.jsx). Mono key→value data chip used in
// stat strips + captions. Grey panel fill, hairline border. (Label uses
// ink-muted, not ink-faint, to hold AA contrast.)

export function MonoChip({
  label,
  value,
  className = "",
}: {
  label?: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {label != null && (
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          {label}:
        </span>
      )}
      <span className="rounded-[5px] border border-line-panel bg-panel px-[7px] py-[2px] font-mono text-[11.5px] font-medium text-ink">
        {value}
      </span>
    </span>
  );
}
