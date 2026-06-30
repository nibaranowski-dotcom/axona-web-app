import type { AgentState } from "@axona/db";
import { AgentGlyph, type AgentTone } from "@/components/ui";

// DS.1 agent roster card — the static AgentGlyph (identity, never animated) + a
// status dot (the ONLY thing that conveys state) + name/role/code + one-line
// description. Selectable.

export interface AgentSummary {
  id: string;
  name: string;
  code: string;
  role: string;
  description: string;
  state: AgentState;
}

// Status-dot tone from AgentState. No invented criticals colour:
//   LIVE → success green · WORKING → lime · CRITICAL → ink · OFFLINE → muted
export function stateTone(state: AgentState): Exclude<AgentTone, "ink"> {
  switch (state) {
    case "LIVE":
      return "live";
    case "WORKING":
      return "working";
    case "CRITICAL":
      return "critical"; // ink dot
    case "OFFLINE":
    default:
      return "offline";
  }
}

export function AgentCard({
  agent,
  selected = false,
  onSelect,
}: {
  agent: AgentSummary;
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={[
        "flex w-full items-start gap-3 rounded-card border p-4 text-left transition-colors duration-200 ease-ease",
        selected
          ? "border-ink-strong bg-panel-2"
          : "border-line-panel bg-panel hover:border-line-strong",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
      ].join(" ")}
    >
      <AgentGlyph
        tone="ink"
        status={stateTone(agent.state)}
        size={28}
        className="mt-0.5 flex-none"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-sans text-sm font-semibold text-ink-strong">
          {agent.name}
        </span>
        <span className="mt-0.5 block font-mono text-[10.5px] uppercase tracking-[0.04em] text-ink-muted">
          {agent.role} · {agent.code}
        </span>
        <span className="mt-1.5 block text-[13px] leading-snug text-ink-muted">
          {agent.description}
        </span>
      </span>
    </button>
  );
}
