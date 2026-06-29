import { zodToJsonSchema } from "zod-to-json-schema";
import type { ModelClient, ModelMessage, ModelResponse } from "./model-client";
import type { AgentContext, AgentDef, RunResult, Tool } from "./types";

// The tool-use loop over a ModelClient. Caps turns; Zod-validates every tool
// input; try/catch per tool; gated tools propose (never execute). Every step is
// a typed trace line.

const MAX_TURNS = 8;

/**
 * RBAC.3 seam — permissive by default. Real per-role guardrails land in RBAC.3;
 * the loop already routes every tool call through here.
 */
export function canUseTool(_ctx: AgentContext, _tool: Tool): boolean {
  return true;
}

// Anthropic message shapes for feeding tool results back next turn.
function assistantBlocks(res: ModelResponse): unknown[] {
  const blocks: unknown[] = [];
  if (res.text) blocks.push({ type: "text", text: res.text });
  for (const t of res.toolUses)
    blocks.push({ type: "tool_use", id: t.id, name: t.name, input: t.input });
  return blocks;
}
function toolOk(id: string, out: unknown): unknown {
  return {
    type: "tool_result",
    tool_use_id: id,
    content: JSON.stringify(out ?? null),
  };
}
function toolError(id: string, msg: string): unknown {
  return { type: "tool_result", tool_use_id: id, content: msg, is_error: true };
}

export async function runLoop(
  def: AgentDef,
  input: string,
  ctx: AgentContext,
  model: ModelClient,
): Promise<{ text: string; status: RunResult["status"] }> {
  const toolSpecs = def.tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: zodToJsonSchema(t.inputSchema) as object,
  }));
  const messages: ModelMessage[] = [{ role: "user", content: input }];
  ctx.trace.push("scan", `agent ${ctx.agentId} · scope ${def.scope}`);

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await model.createMessage({
      system: def.systemPrompt,
      messages,
      tools: toolSpecs,
    });
    ctx.trace.push("correlate", `model ${res.model} · stop ${res.stopReason}`, {
      model: res.model,
    });

    if (res.stopReason !== "tool_use") {
      ctx.trace.push("result", res.text);
      return { text: res.text, status: "SUCCEEDED" };
    }

    messages.push({ role: "assistant", content: assistantBlocks(res) });
    const toolResults: unknown[] = [];
    for (const call of res.toolUses) {
      const tool = def.tools.find((t) => t.name === call.name);
      if (!tool) {
        ctx.trace.push("error", `unknown tool ${call.name}`);
        toolResults.push(toolError(call.id, "unknown tool"));
        continue;
      }

      // permission seam (RBAC.3 enforces later)
      if (!canUseTool(ctx, tool)) {
        ctx.trace.push("policy-check", `denied ${tool.name} for role`);
        toolResults.push(toolError(call.id, "not permitted"));
        continue;
      }

      // gating: money/safety/contract → propose, do NOT execute. Keyed on the
      // flag OR the category (defense in depth — a gated tool missing the flag
      // still never runs autonomously).
      if (tool.gated || tool.category === "gated") {
        ctx.trace.push(
          "proposal",
          `proposed ${tool.name} (awaiting human approval)`,
          call.input,
        );
        return {
          text: `Proposed ${tool.name}; awaiting approval.`,
          status: "AWAITING_APPROVAL",
        };
      }

      const parsed = tool.inputSchema.safeParse(call.input);
      if (!parsed.success) {
        ctx.trace.push(
          "error",
          `invalid input for ${tool.name}: ${parsed.error.message}`,
        );
        toolResults.push(toolError(call.id, "invalid input"));
        continue;
      }

      ctx.trace.push("tool", `${tool.name}(${JSON.stringify(parsed.data)})`);
      try {
        const out = await tool.handler(parsed.data, ctx);
        ctx.trace.push("tool-result", `${tool.name} ok`, out);
        toolResults.push(toolOk(call.id, out));
      } catch (e) {
        ctx.trace.push("error", `${tool.name} failed: ${(e as Error).message}`);
        toolResults.push(toolError(call.id, "tool error"));
      }
    }
    messages.push({ role: "user", content: toolResults });
  }

  ctx.trace.push("error", `turn cap (${MAX_TURNS}) reached`);
  return { text: "Run exceeded the turn limit.", status: "FAILED" };
}
