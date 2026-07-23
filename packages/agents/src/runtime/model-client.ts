import type Anthropic from "@anthropic-ai/sdk";

// The loop depends on this interface (DI), never the SDK directly — so the
// FakeModelClient keeps `pnpm verify:art-1` offline and CI deterministic.
//
// The concrete SDK is imported LAZILY (dynamic import inside createMessage), so a
// static `import` of "@anthropic-ai/sdk" never enters any consumer's bundle graph.
// This matters because @axona/agents is transpiled into apps/web (RBAC.4 pulls
// resumeParkedRun through the barrel) — an eager SDK import broke `next build`
// ("Cannot get final name for export 'AnthropicError'"). The type-only import above
// is erased at build time; the value loads only on a real API call.

export interface ModelMessage {
  role: "user" | "assistant";
  content: unknown;
}
export interface ModelToolSpec {
  name: string;
  description: string;
  input_schema: object;
}
/** Per-call token usage (RUNTIME.1 run observability). */
export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
}
export interface ModelResponse {
  stopReason: "end_turn" | "tool_use" | "max_tokens";
  /** concatenated text blocks */
  text: string;
  toolUses: { id: string; name: string; input: unknown }[];
  model: string;
  /** Tokens spent on this call, when the client reports them (RUNTIME.1). */
  usage?: ModelUsage;
}
export interface ModelClient {
  createMessage(args: {
    system: string;
    messages: ModelMessage[];
    tools: ModelToolSpec[];
  }): Promise<ModelResponse>;
}

// Sonnet-tier default; confirmed current id (docs.claude.com). NEVER hardcode a
// stale literal in call sites — read it here from env, default below.
const DEFAULT_MODEL = "claude-sonnet-4-6";

// RUNTIME.1 — the old 1024 answer cap truncated blast-radius/RCA markdown tables
// mid-answer. Raise it to a sensible default (overridable via env) so long answers
// aren't silently cut; the loop still detects `max_tokens` and flags truncation.
const DEFAULT_MAX_TOKENS = 4096;
function resolveMaxTokens(): number {
  const n = Number.parseInt(process.env.ANTHROPIC_MAX_TOKENS ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_TOKENS;
}

/** Real impl — wraps @anthropic-ai/sdk (loaded lazily). Model + key from env. */
export class AnthropicModelClient implements ModelClient {
  private readonly model: string;
  private readonly apiKey: string;
  private client?: Anthropic;

  constructor(opts: { model?: string; apiKey?: string } = {}) {
    const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    this.apiKey = apiKey;
    this.model = opts.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  }

  // Lazily construct the SDK client on first use (see the module note above).
  private async getClient(): Promise<Anthropic> {
    if (!this.client) {
      const AnthropicSDK = (await import("@anthropic-ai/sdk")).default;
      this.client = new AnthropicSDK({ apiKey: this.apiKey });
    }
    return this.client;
  }

  async createMessage(args: {
    system: string;
    messages: ModelMessage[];
    tools: ModelToolSpec[];
  }): Promise<ModelResponse> {
    const client = await this.getClient();
    const res = await client.messages.create({
      model: this.model,
      max_tokens: resolveMaxTokens(),
      system: args.system,
      messages: args.messages as Anthropic.MessageParam[],
      tools: args.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Tool.InputSchema,
      })),
    });

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const toolUses = res.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
      .map((b) => ({ id: b.id, name: b.name, input: b.input }));
    const stopReason: ModelResponse["stopReason"] =
      res.stop_reason === "tool_use"
        ? "tool_use"
        : res.stop_reason === "max_tokens"
          ? "max_tokens"
          : "end_turn";

    return {
      stopReason,
      text,
      toolUses,
      model: res.model,
      usage: {
        inputTokens: res.usage?.input_tokens ?? 0,
        outputTokens: res.usage?.output_tokens ?? 0,
      },
    };
  }
}

/** Deterministic, no network — for verify + unit tests. */
export class FakeModelClient implements ModelClient {
  private i = 0;
  constructor(private readonly script: ModelResponse[]) {}

  async createMessage(): Promise<ModelResponse> {
    const res = this.script[Math.min(this.i++, this.script.length - 1)];
    if (!res) throw new Error("FakeModelClient: empty script");
    return res;
  }
}
