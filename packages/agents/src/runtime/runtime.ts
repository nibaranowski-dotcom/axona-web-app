import { zodToJsonSchema } from "zod-to-json-schema";
import { assembleContext, type MemoryEntityType } from "@axona/db";
import type { ModelClient, ModelMessage, ModelResponse } from "./model-client";
import type {
  AgentContext,
  AgentDef,
  RunResult,
  RunUsage,
  Tool,
} from "./types";

// The tool-use loop over a ModelClient. Caps turns; Zod-validates every tool
// input; try/catch per tool; gated tools propose (never execute). Every step is
// a typed trace line.

const MAX_TURNS = 8;

// RUNTIME.1 — context pruning. The loop appends the assistant turn + every tool
// result each turn, so an 8-turn run would carry all prior (often large) tool
// payloads to every model call — the "relevance beats volume" failure. We keep
// the transcript itself complete (source of truth for the next turn) but send a
// PRUNED copy to the model: the initial task + the last few turns verbatim, with
// older verbose tool payloads elided. This changes ONLY what is re-sent to the
// model — tool behavior and the audit trace are untouched.
const KEEP_RECENT_MESSAGES = 4; // ≈ the last two turns carried verbatim
const MAX_TEXT_CHARS = 2000; // cap any single carried text/payload

function capText(s: string): string {
  return s.length > MAX_TEXT_CHARS
    ? `${s.slice(0, MAX_TEXT_CHARS)}…[+${s.length - MAX_TEXT_CHARS} chars elided]`
    : s;
}

// Elide a single content block from an OLDER turn — the big win is dropping the
// verbose tool_result payloads once the model has moved past them.
function elideBlock(block: unknown): unknown {
  if (!block || typeof block !== "object") return block;
  const b = block as Record<string, unknown>;
  if (b.type === "tool_result") {
    return {
      type: "tool_result",
      tool_use_id: b.tool_use_id,
      content: "[tool result elided — older turn]",
      ...(b.is_error ? { is_error: true } : {}),
    };
  }
  if (b.type === "tool_use") {
    // keep the call shape (id/name) but drop the (re-derivable) input payload
    return { type: "tool_use", id: b.id, name: b.name, input: {} };
  }
  if (b.type === "text" && typeof b.text === "string") {
    return { type: "text", text: capText(b.text) };
  }
  return block;
}

/**
 * The transcript actually sent to the model each turn — BOUNDED, not linear in
 * turns. Keeps the initial task (index 0) + the last `keepRecent` messages
 * verbatim; older messages have their verbose tool payloads elided. Pure: returns
 * a new array, never mutates the caller's transcript. Exported so verify can
 * assert the carried size stays bounded across an 8-turn run.
 */
export function pruneMessages(
  messages: ModelMessage[],
  keepRecent = KEEP_RECENT_MESSAGES,
): ModelMessage[] {
  const n = messages.length;
  return messages.map((m, i) => {
    if (i === 0 || i >= n - keepRecent) return m; // task + recent window verbatim
    if (Array.isArray(m.content)) {
      return { role: m.role, content: m.content.map(elideBlock) };
    }
    if (typeof m.content === "string") {
      return { role: m.role, content: capText(m.content) };
    }
    return m;
  });
}

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

// MEM.2 — auto-inject operational memory. Detect the subject ENTITY in the user's
// question (an NCR/ECO/unit/part/lot code) or a "have we seen this before" precedent
// cue, so the runtime can assemble the relevant prior episodes WITHOUT the agent
// having to call recallMemory by hand. The explicit recallMemory tool stays too.
const SUBJECT_PATTERNS: { re: RegExp; type: MemoryEntityType }[] = [
  { re: /\bNCR-[A-Z]?\d+\b/i, type: "NCR" },
  { re: /\bECO-[A-Z]?\d+\b/i, type: "ECO" },
  { re: /\bSN-[A-Z0-9-]+\b/i, type: "UNIT" },
  {
    re: /\b(?:SERVO|HARN|BATT|SENS|SENSOR|COMPUTE|GRIP|CHASSIS|CTRL|BMS|POWER|AIRFRAME)-[A-Z0-9]+\b/i,
    type: "PART",
  },
  { re: /\blot\s*[- ]?\d{4,}\b/i, type: "LOT" },
  { re: /\bDLV-[A-Z]?\d+\b/i, type: "DELIVERY" },
  { re: /\bPO-[A-Z0-9]+\b/i, type: "PURCHASE_ORDER" },
];
const PRECEDENT_CUE =
  /\b(seen this|before|prior|precedent|last time|have we|previously|recurr|happened again|history)\b/i;

/** The first recognized subject entity in the text (its human code), if any. */
function detectSubject(
  text: string,
): { type: MemoryEntityType; id: string } | undefined {
  for (const { re, type } of SUBJECT_PATTERNS) {
    const m = text.match(re);
    if (m) return { type, id: m[0].toUpperCase() };
  }
  return undefined;
}

/**
 * MEM.2 — assemble + return the operational-memory block for this turn (or "" when
 * nothing should be injected), pushing the legible `memory` trace line either way
 * (injected N · or the honest no-inject reason). Only fires when a subject is in
 * play or the question implies precedent — never on unrelated turns.
 */
async function injectMemory(input: string, ctx: AgentContext): Promise<string> {
  const subject = detectSubject(input);
  const impliesPrecedent = PRECEDENT_CUE.test(input);
  if (!subject && !impliesPrecedent) return "";

  const assembled = await assembleContext(ctx.db, {
    orgId: ctx.orgId,
    subject,
    query: input,
  });

  if (assembled.injected > 0 && assembled.top) {
    const t = assembled.top;
    const anchor = t.subjectCode ?? t.kind;
    const out = t.outcome ? ` ${t.outcome.toUpperCase()}` : "";
    ctx.trace.push(
      "memory",
      `injected ${assembled.injected} prior episode${
        assembled.injected === 1 ? "" : "s"
      }, top = ${anchor}${out} conf ${t.confidence.toFixed(2)}`,
      {
        injected: assembled.injected,
        tokensUsed: assembled.tokensUsed,
        budget: assembled.budget,
        top: t.provenance,
      },
    );
    return assembled.block;
  }

  // Honest no-inject: cold-start / below-floor / no-subject — the trace shows the decision.
  ctx.trace.push("memory", `no prior episodes injected (${assembled.reason})`, {
    reason: assembled.reason,
  });
  return "";
}

export async function runLoop(
  def: AgentDef,
  input: string,
  ctx: AgentContext,
  model: ModelClient,
): Promise<{
  text: string;
  status: RunResult["status"];
  truncated: boolean;
  usage: RunUsage | null;
}> {
  const toolSpecs = def.tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: zodToJsonSchema(t.inputSchema) as object,
  }));
  const messages: ModelMessage[] = [{ role: "user", content: input }];
  ctx.trace.push("scan", `agent ${ctx.agentId} · scope ${def.scope}`);

  // MEM.2 — auto-inject relevant operational memory into the system context for
  // this run (retrieval-augmentation that FIRES, no manual recallMemory call). The
  // block is bounded (its own token budget) and lands in the system prompt, so it
  // never blows RUNTIME.1's transcript window. Memory INFORMS; the agent still
  // proposes→approve→audit. Empty on cold-start / below-floor (honest).
  const memoryBlock = await injectMemory(input, ctx);
  const systemPrompt = memoryBlock
    ? `${def.systemPrompt}\n\n${memoryBlock}`
    : def.systemPrompt;

  // RUNTIME.1 — accumulate token usage across every model call in the run.
  let promptTokens = 0;
  let completionTokens = 0;
  let sawUsage = false;
  const usage = (): RunUsage | null =>
    sawUsage
      ? {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        }
      : null;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await model.createMessage({
      system: systemPrompt, // MEM.2 — def prompt + the injected memory block (if any)
      // send a BOUNDED copy of the transcript — never the full linear history
      messages: pruneMessages(messages),
      tools: toolSpecs,
    });
    if (res.usage) {
      promptTokens += res.usage.inputTokens;
      completionTokens += res.usage.outputTokens;
      sawUsage = true;
    }
    ctx.trace.push("correlate", `model ${res.model} · stop ${res.stopReason}`, {
      model: res.model,
    });

    if (res.stopReason !== "tool_use") {
      // RUNTIME.1 — a max_tokens stop means the answer was CUT. Surface it
      // explicitly (trace + a visible marker) — never a silent truncation.
      const truncated = res.stopReason === "max_tokens";
      if (truncated) {
        ctx.trace.push(
          "error",
          "answer hit the model token cap — flagged as truncated (not silently cut)",
        );
      }
      ctx.trace.push("result", res.text);
      const text = truncated
        ? `${res.text}\n\n_[Answer truncated at the model token cap — raise ANTHROPIC_MAX_TOKENS or narrow the question.]_`
        : res.text;
      return { text, status: "SUCCEEDED", truncated, usage: usage() };
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
          truncated: false,
          usage: usage(),
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
  return {
    text: "Run exceeded the turn limit.",
    status: "FAILED",
    truncated: false,
    usage: usage(),
  };
}
