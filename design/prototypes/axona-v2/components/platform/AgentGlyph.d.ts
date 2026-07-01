import { CSSProperties, HTMLAttributes } from "react";

/**
 * The Axona agent identity mark — a static 12-dot ring.
 *
 * @startingPoint section="Platform" subtitle="Agent identity glyph — the dot-ring avatar" viewport="220x80"
 */
export interface AgentGlyphProps extends HTMLAttributes<HTMLSpanElement> {
  /** Pixel size of the square glyph. Default 24. */
  size?: number;
  /** SVG fill for the dots. Default near-black. */
  fill?: string;
  /** Optional status dot color (e.g. var(--success), var(--accent), var(--ink-strong)). */
  status?: string;
  /** Selection ring: "active" (ink) or "idle" (hairline). */
  ring?: "active" | "idle";
  style?: CSSProperties;
}

export function AgentGlyph(props: AgentGlyphProps): JSX.Element;
