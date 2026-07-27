# PRD — EVAL.1 · Agent & prompt evaluation harness

**Story:** EVAL.1 — A lightweight, offline eval harness that regression-tests the agents: prompt behavior, tool
selection, structured-output robustness, and the moat's headline behaviors (blast radius, memory recall,
calibrated confidence). So a prompt or tool change can't silently regress.
**Pri/size:** P1 · M. **Track:** Moat spine / agent quality. **Depth:** Condensed CPRD.
**Deps:** ART.1/ART.2 (runtime + typed tool registry), the `FakeModelClient` DI, ONT.1/MEM.1/CONF.1.

## Why

Best practice — "treat prompts like source: version, review, **test**." We version prompts (they're in code) and
review them, but **nothing tests them.** When MEM.1a added recall instructions to the Axona system prompt,
nothing would have caught a regression. For a product whose behavior *is* its prompts + tool wiring, that's the
biggest untested surface. EVAL.1 adds the missing feedback loop.

## Goals

1. **A scenario harness** — a set of eval cases (`{ situation, expected }`) run offline against the agent runtime
   with the **`FakeModelClient`** (deterministic, no key, CI-safe) where possible, and a **live/opt-in** tier
   (behind an env flag) for real-model behavioral checks that don't run in CI.
2. **What it asserts** (the cases that matter):
   - **Tool selection** — for a blast-radius question the agent calls `getBlastRadius`; for a "have we seen this"
     question it calls / receives `recallMemory`. (Assert the tool loop, not the prose.)
   - **Structured-output robustness** — malformed model output is handled gracefully (the low-confidence
     fallback fires; the loop doesn't crash) — sweep the places that parse structured output, confirm each has a
     fallback like MTX.1's.
   - **Grounding / no-fabrication** — the agent cites real records and does not invent links/memories when none
     exist (the honest cold-start behavior).
   - **Moat behaviors** — blast radius returns the seeded cascade; recall surfaces the precedent via graph;
     calibrated confidence corrects an over-confident case.
3. **Runnable as a gate** — `pnpm eval` (offline tier) wired so it *can* run in CI (FakeModelClient, no key) and
   fails on a regression; the live tier is a manual/opt-in run documented in `docs/manual-checks.md`.
4. **A scoreboard** — prints pass/fail per case + a one-line summary; a regression is a non-zero exit.

## Non-goals (flag)

Full LLM-as-judge scoring rubric → later. Prompt *optimization* → later (this is regression detection, not
tuning). Retraining/fine-tuning → LOOP.1/SLM.

## Guardrails

Offline tier deterministic + CI-green with no API key (FakeModelClient) · live tier opt-in behind an env flag,
never in the default gate · per-tenant fixtures (eval org isolated) · eval self-cleans any rows it creates
(MIGRATE.1 self-clean discipline).

## Verify + gate (`src/scripts/verify-eval-1.ts` + `pnpm eval`)

1. `pnpm eval` (offline) runs the scenario set with FakeModelClient, prints per-case pass/fail, exits non-zero on
   any failure, and is CI-green with no key.
2. The tool-selection cases assert the real tool loop (getBlastRadius / recallMemory fire on the right
   questions).
3. A structured-output-malformed case is handled (fallback fires, no crash).
4. A grounding case confirms no fabrication when data is absent.
5. Eval self-cleans; existing verifies stay green.
CI gate: install --frozen-lockfile · lint · turbo typecheck · verify:all · **pnpm eval (offline)** · pnpm build;
commit + push; Actions green.

## Review gate

Stop after EVAL.1; show: `pnpm eval` output (per-case pass/fail), a deliberately-broken prompt failing a case
(proving the harness catches regressions), and the CI wiring.
