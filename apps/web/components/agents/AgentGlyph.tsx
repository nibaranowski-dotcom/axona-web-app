// The Axona agent identity mark — a static 12-dot ring (DS.1, NEVER animated;
// it reads as identity, not a spinner). Exact dot coordinates from the design
// system (components/platform/AgentGlyph.jsx). Token-driven fills; optional
// status dot + focus/active ring.

export type AgentTone = "ink" | "live" | "working" | "critical" | "offline";

const fillClass: Record<AgentTone, string> = {
  ink: "fill-ink-strong",
  live: "fill-success",
  working: "fill-accent",
  critical: "fill-ink-strong",
  offline: "fill-ink-faint",
};

const statusBg: Record<Exclude<AgentTone, "ink">, string> = {
  live: "bg-success",
  working: "bg-accent",
  critical: "bg-ink-strong",
  offline: "bg-ink-faint",
};

// 12 dots around a 24px ring (verbatim DS coordinates).
const DOTS: ReadonlyArray<readonly [number, number]> = [
  [12, 4.6],
  [15.7, 5.6],
  [18.4, 8.3],
  [19.4, 12],
  [18.4, 15.7],
  [15.7, 18.4],
  [12, 19.4],
  [8.3, 18.4],
  [5.6, 15.7],
  [4.6, 12],
  [5.6, 8.3],
  [8.3, 5.6],
];

export function AgentGlyph({
  tone = "ink",
  status,
  size = 24,
  className = "",
  decorative = false,
}: {
  tone?: AgentTone;
  status?: Exclude<AgentTone, "ink">;
  size?: number;
  className?: string;
  // When the surrounding control already names the agent (an avatar button),
  // mark the glyph decorative so screen readers don't double-announce it.
  decorative?: boolean;
}) {
  return (
    <span
      className={`relative inline-flex ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        role={decorative ? undefined : "img"}
        aria-label={decorative ? undefined : "Axona agent"}
        aria-hidden={decorative || undefined}
        className={fillClass[tone]}
      >
        {DOTS.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={1.55} />
        ))}
      </svg>
      {status && (
        <span
          aria-hidden
          className={`absolute bottom-0 right-0 h-[28%] w-[28%] min-h-[6px] min-w-[6px] rounded-pill border-[1.5px] border-panel ${statusBg[status]}`}
        />
      )}
    </span>
  );
}
