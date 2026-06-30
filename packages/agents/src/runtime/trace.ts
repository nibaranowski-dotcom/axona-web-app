import type { TraceKind, TraceLine } from "./types";

// Collects typed, timestamped trace lines for one run. Persisted on the AgentRun
// (run-agent.ts) and rendered by the ART.5 trace console.
//
// Optional `onLine` sink (ART.4): fires for each line AS it's pushed — the live
// seam SSE streams through now, and ART.5 (console) + OBS.1 (Langfuse) plug into
// later. Keep it generic: no transport/console/Langfuse specifics here. With no
// sink, behaviour is identical to ART.1 (back-compat).
export class TraceCollector {
  readonly lines: TraceLine[] = [];

  constructor(private readonly onLine?: (line: TraceLine) => void) {}

  push(
    kind: TraceKind,
    text: string,
    data?: unknown,
    confidence?: number,
  ): TraceLine {
    const line: TraceLine = {
      ts: new Date().toISOString(),
      kind,
      text,
      ...(data !== undefined ? { data } : {}),
      ...(confidence !== undefined ? { confidence } : {}),
    };
    this.lines.push(line);
    this.onLine?.(line);
    return line;
  }
}
