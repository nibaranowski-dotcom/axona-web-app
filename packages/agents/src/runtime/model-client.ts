import Anthropic from "@anthropic-ai/sdk";

// The loop depends on this interface (DI), never the SDK directly — so the
// FakeModelClient keeps `pnpm verify:art-1` offline and CI deterministic.

export interface ModelMessage {
  role: "user" | "assistant";
  content: unknown;
}
export interface ModelToolSpec {
  name: string;
  description: string;
  input_schema: object;
}
export interface ModelResponse {
  stopReason: "end_turn" | "tool_use" | "max_tokens";
  /** concatenated text blocks */
  text: string;
  toolUses: { id: string; name: string; input: unknown }[];
  model: string;
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

/** Real impl — wraps @anthropic-ai/sdk. Model + key from env. */
export class AnthropicModelClient implements ModelClient {
  private readonly model: string;
  private readonly client: Anthropic;

  constructor(opts: { model?: string; apiKey?: string } = {}) {
    const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    this.model = opts.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
    this.client = new Anthropic({ apiKey });
  }

  async createMessage(args: {
    system: string;
    messages: ModelMessage[];
    tools: ModelToolSpec[];
  }): Promise<ModelResponse> {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
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

    return { stopReason, text, toolUses, model: res.model };
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
