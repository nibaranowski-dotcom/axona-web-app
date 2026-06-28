import type { TraceKind, TraceLine } from "./types";

// Collects typed, timestamped trace lines for one run. Persisted on the AgentRun
// (run-agent.ts) and rendered by the ART.5 trace console.
export class TraceCollector {
  readonly lines: TraceLine[] = [];

  push(
    kind: TraceKind,
    text: string,
    data?: unknown,
    confidence?: number,
  ): void {
    this.lines.push({
      ts: new Date().toISOString(),
      kind,
      text,
      ...(data !== undefined ? { data } : {}),
      ...(confidence !== undefined ? { confidence } : {}),
    });
  }
}
