import type { TraceLine } from "@axona/agents";

// Client helper for the agent chat SSE endpoint (ART.4). AGT.1 renders these
// events (trace lines in the console, the final answer in the thread); this
// file is the transport only — no UI.

export type ChatEventType = "trace" | "proposal" | "message" | "done" | "error";

export interface ChatEvent {
  type: ChatEventType;
  data: unknown;
}

/** Trace + proposal events carry a TraceLine. */
export interface TraceChatEvent extends ChatEvent {
  type: "trace" | "proposal";
  data: TraceLine;
}

/** The final answer. */
export interface MessageChatEvent extends ChatEvent {
  type: "message";
  data: {
    chatId: string;
    text: string;
    status: "SUCCEEDED" | "FAILED" | "AWAITING_APPROVAL";
    runId: string;
  };
}

/**
 * POST to the SSE endpoint and yield parsed events in order. Consumed by AGT.1.
 * Pass a `chatId` to continue a thread, and an `AbortSignal` to cancel the run.
 */
export async function* streamAgentChat(
  agentId: string,
  message: string,
  chatId?: string,
  signal?: AbortSignal,
): AsyncGenerator<ChatEvent> {
  const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, chatId }),
    signal,
  });
  if (!res.ok || !res.body) {
    yield {
      type: "error",
      data: { message: `chat request failed (${res.status})` },
    };
    return;
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    // SSE frames are separated by a blank line.
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const type = (/event: (.*)/.exec(frame)?.[1] ??
        "message") as ChatEventType;
      const raw = /data: (.*)/s.exec(frame)?.[1];
      yield { type, data: raw ? JSON.parse(raw) : null };
    }
  }
}
