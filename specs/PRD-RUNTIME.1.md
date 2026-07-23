# PRD — RUNTIME.1 · Agent-loop hardening (context pruning · token cap · run observability)

**Story:** RUNTIME.1 — Three corrective fixes to the agent runtime surfaced by a harness-engineering review:
verify the loop prunes context (not just appends), confirm/raise the `max_tokens` answer cap so long answers
aren't silently truncated, and add per-run token/cost observability on `AgentRun`.
**Pri/size:** P1 · S–M. **Track:** Moat spine / agent runtime. **Depth:** Condensed.
**Deps:** ART.1 (`runtime.ts` tool-use loop, `MAX_TURNS=8`), ART.4 (SSE), AUDIT.3 (`AgentRun`).

## Why

A production-agent review (12-Factor Agents / Anthropic harness guidance) flags three things worth confirming or
fixing in `packages/agents/src/runtime/`:

1. **Context grows every turn.** With `MAX_TURNS=8` appending each tool result, the context window fills with
   marginal material — the exact "relevance beats volume" failure. Confirm the loop **prunes/trims** older
   tool-result payloads rather than carrying all of them to every call. (This is distinct from MEM.2, which adds
   *retrieval*; this is about not drowning the window with stale tool output.)
2. **`max_tokens: 1024`** on the model call (`model-client.ts`) is a low answer cap. The blast-radius/RCA answers
   render markdown tables near that ceiling. Confirm the loop **handles `stop_reason: "max_tokens"`** (continues
   or flags truncation) rather than silently cutting the answer, and raise the cap for the final answer turn if
   warranted.
3. **No per-run token/cost visibility.** `AgentRun` doesn't record tokens spent. For a product that will run many
   agents, cost observability is a needed seam (and it feeds the "autonomy costs tokens" tradeoff).

## Scope

1. **Context pruning** — in the tool-use loop, cap/trim the transcript carried to each model call (e.g. keep the
   system prompt + the last N turns' tool results + a summary of older ones, or drop verbose tool payloads once
   consumed). Do NOT change tool behavior; only what's re-sent. Keep the trace complete (pruning affects the
   model's context, not the audit trace).
2. **Token-cap handling** — detect `stop_reason: "max_tokens"`; either continue the turn or surface an explicit
   "answer truncated" state (never a silent cut). Raise `max_tokens` for the answer turn to a sensible value.
3. **Run observability** — add `promptTokens`/`completionTokens`/`totalTokens` (nullable) to `AgentRun` (or a
   sibling), populated from the model client's usage; surface on the workflow/agent run views if trivial.
   `migrate dev` only; add to `TENANT_MODELS` if it's a new table (it's a column on the existing `AgentRun`, so
   no isolation change).

## Guardrails

Non-breaking: existing agent behavior/traces unchanged except pruning + truncation handling; `MAX_TURNS` escape
hatch stays; migrate dev only; verify self-cleans; per-tenant isolation intact.

## Verify + gate (`src/scripts/verify-runtime-1.ts`)

1. The loop trims context — a synthetic 8-turn run does not re-send every prior tool payload verbatim (assert
   the carried-context size is bounded, not linear in turns).
2. A response hitting the token cap is handled explicitly (continued or flagged), never silently truncated.
3. `AgentRun` carries token counts populated from a run; migrate status clean.
CI gate: install --frozen-lockfile · lint · turbo typecheck · verify:all · pnpm build · migrate clean; commit +
push; Actions green.

## Review gate

Stop after RUNTIME.1; show: the bounded-context assertion, a token-cap-handled response, and an `AgentRun` row
with token counts.
