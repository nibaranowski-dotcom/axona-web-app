// Static 12-dot ring (NEVER animated; design.md). Status dot color = agent state.
// Minimal version introduced in FND.13 for the shell; FND.15 may extend it.

export type AgentTone = "live" | "working" | "critical" | "offline" | "neutral";

const toneFill: Record<AgentTone, string> = {
  live: "fill-success",
  working: "fill-accent",
  critical: "fill-ink-strong",
  offline: "fill-ink-faint",
  neutral: "fill-ink-faint",
};

export function AgentGlyph({
  tone = "neutral",
  size = 24,
  className = "",
}: {
  tone?: AgentTone;
  size?: number;
  className?: string;
}) {
  const r = size / 2;
  const ring = r - Math.max(2, size / 12);
  const dot = Math.max(1, size / 14);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label={`agent ${tone}`}
    >
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const cx = r + ring * Math.cos(a);
        const cy = r + ring * Math.sin(a);
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={dot}
            className={i === 0 ? toneFill[tone] : "fill-ink-faint"}
          />
        );
      })}
    </svg>
  );
}
