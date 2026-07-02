# Stack-Automation — side backlog (deferred)

**What this is:** a parked project to automate the **Cowork (Joe) → Claude Code** handoff loop so the
next story's PRD is generated and executed without manual copy-paste. Researched + stored now; **not to be
built during the Axona screen build** — pick it up as its own project later. Figures/flags verified July 2026
(re-verify at code.claude.com/docs before building — the SDK and flags move fast).

## One-liner
Turn the current manual loop — *Joe writes a PRD → Nicolas pastes it into Claude Code → CC implements →
Nicolas reviews → repeat* — into a **semi-automated pipeline**: the next `todo` story is dequeued, Joe
generates its PRD, Claude Code (headless) implements it, the gates run, and it commits on green — with a
**human review gate kept on UI/moat stories** (the part that has repeatedly caught what automation can't).

---

## Verified substrate (July 2026)

- **Claude Agent SDK (TS/Python)** drives the exact Claude Code agent loop — tool use, permissions,
  subagents, hooks, sessions — from your own program; runs headless / unattended. On Sonnet 4.6 / Opus 4.7.
  ([code.claude.com/docs/agent-sdk](https://code.claude.com/docs/en/agent-sdk/subagents))
- **Headless Claude Code:** `claude -p` (print mode) = one prompt in, one result out;
  `--output-format json/stream-json` for machine-readable output; env-based auth (API key / Bedrock /
  Vertex) replaces interactive login. ([code.claude.com/docs/headless](https://code.claude.com/docs/en/headless))
- **Unattended permissions:** `--permission-mode dontAsk` + an explicit `--allowedTools "Bash,Read,Edit,…"`
  minimal surface with a hard-deny default. Plus **Auto Mode** (Research Preview, Mar 2026) — a background
  **safety classifier** that reviews each action before execution, allowing autonomy while blocking
  dangerous ops. ([SFEIR](https://institute.sfeir.com/en/claude-code/claude-code-headless-mode-and-ci-cd/))
- **Subagents in the SDK** isolate context + run in parallel (a coordinator fan-outs); for coordinating
  dozens–hundreds of agents there's a **Workflow tool** that runs the orchestration in a script outside the
  conversation context. ([platform.claude.com/docs/agent-sdk](https://platform.claude.com/docs/en/agent-sdk/subagents))
- **GitHub Actions:** `anthropics/claude-code-action@v1` wraps a headless run + GH plumbing (`prompt`,
  `claude_args`, `anthropic_api_key`); does autonomous PR fixes, CI-failure fixes, reviews.
  ([Groundy guide](https://groundy.com/articles/how-to-run-claude-code-as-a-github-actions-agent-for-automated-pr-fixes/))
- **Billing note:** from **June 15, 2026**, Agent SDK + Claude Code GitHub Actions usage is metered
  **separately** from interactive Claude Code — budget the loop's token/compute cost explicitly.

## Architecture (semi-auto is the target, not full-auto)

```
queue (next todo w/ deps met)
   → Joe agent (Agent SDK / CC subagent): row + design file + CLAUDE.md  → writes PRD to /specs
   → Claude Code headless (claude -p, dontAsk + allowedTools)            → implements the PRD
   → gates: tsc --noEmit · verify:all · accessibility-review             → block on red (no advance)
   → route by story type:
        mechanical (data/API, schemas) → auto-commit + push + mark done  → loop
        UI / moat / gated-action       → PAUSE for human review          → resume on approve
```
State in a queue (JSON/SQLite or GitHub Issues/Linear); git is the record; hooks/`Stop` events trigger the
next step; a scoped allowlist + the push-to-main guard + a cost ceiling keep it safe unattended.

---

## Backlog (CPRD-ready)

| Pos | StoryID | Title | Pri | Size | Effort(d) | Deps |
|---|---|---|---|---|---|---|
| 1 | SA.1 | Machine-readable story queue — backlog rows → JSON/SQLite with `status` + `deps`; "next runnable" selector | P0 | S | 1 | — |
| 2 | SA.2 | Joe headless agent — Agent SDK call (or `.claude/agents/joe.md` subagent) that takes a row + its design file + CLAUDE.md and writes the PRD to `/specs` | P0 | M | 1–2 | SA.1 |
| 3 | SA.3 | Claude Code headless executor — `claude -p` / SDK run of a PRD with `--permission-mode dontAsk` + explicit `--allowedTools`; capture `stream-json` result | P0 | M | 1 | — |
| 4 | SA.4 | Orchestrator loop — dequeue → SA.2 → SA.3 → gates → commit/push → advance; retry/stop on failure | P0 | M | 1–2 | SA.1–3 |
| 5 | SA.5 | Gates + guardrails — block-on-red (tsc/verify/a11y), scoped allowlist, hard-deny default, push-to-main guard, per-run cost ceiling | P0 | M | 1 | SA.4 |
| 6 | SA.6 | Story-type routing — mechanical (data/API/schema) run unattended; UI/moat/gated-action pause for human review | P0 | S | 0.5 | SA.4 |
| 7 | SA.7 | Human-in-the-loop UX — a `next` command: generate PRD → run CC → show diff/screens → approve/reject/redo, no copy-paste | P1 | M | 1 | SA.4, SA.6 |
| 8 | SA.8 | Visual-diff fidelity gate (optional) — screenshot the built screen, diff vs the rendered `.dc.html`; surface deltas for the human gate | P2 | L | 2–3 | SA.5 |
| 9 | SA.9 | GitHub Actions variant (optional) — `anthropics/claude-code-action@v1`, PR-per-story, gates in CI, auto-merge on green (mechanical) or human review (UI) | P2 | M | 1–2 | SA.4 |
| 10 | SA.10 | Observability + cost — trace each Joe/CC run (Langfuse, ties to Axona's OBS.1), token/compute accounting per story, run history | P1 | M | 1 | SA.4 |
| 11 | SA.11 | Auto Mode evaluation (optional) — pilot the safety-classifier `Auto Mode` permission for the mechanical lane; measure false-blocks vs a static allowlist | P2 | S | 0.5 | SA.3 |

**Totals:** MVP = SA.1–SA.6 (~1–2 focused days). Robust semi-auto = through SA.7 + SA.10 (~1 week). Optional
full-auto/CI/visual-diff = SA.8/SA.9/SA.11 (a few more days, lowest ROI).

---

## Decisions & open questions
- **Semi-auto, not full-auto (recommended).** The human review gate has caught things no automated gate can:
  design fidelity (verify is green while a screen is visually wrong — the ENG.2 kanban), "which design file
  is right," deferred-decision judgment (add schema vs defer), auth/repo mixups. `verify` proves structural +
  functional correctness; it cannot prove "matches the approved design" or "right product call." Keep the
  human on UI/moat stories; auto-run only the mechanical lane.
- **Safety of unattended runs:** prefer an explicit `--allowedTools` + `dontAsk` + hooks over blanket skip;
  evaluate `Auto Mode` (SA.11) as a second layer. Never let the loop do the Prohibited actions (secrets,
  perms changes, destructive deletes, money moves) — hard-deny.
- **Cost:** the loop bills separately (post Jun-15-2026); set a per-run + per-day token ceiling.
- **Meta note:** Claude Code would build its own orchestration harness — fine, but sandbox the loop so a
  buggy orchestrator can't push half-built stories to main (rely on the gates + the push guard).

## ROI / when to build
Copy-paste costs *seconds*/story; the real time is CC's build time + the human review — both kept either
way. Value = (a) the **mechanical lane runs hands-off** while you do something else, and (b) no
context-switching to relay blocks. Over ~110 remaining Axona stories with ~half mechanical, a ~1-week build
plausibly saves a couple of days of attention — pays for itself, not a 10×. **Don't pause the Axona build
for it; build it as its own project afterward** (or run *it* through the same one-story discipline).

## Sources
- Agent SDK / subagents — [code.claude.com/docs](https://code.claude.com/docs/en/agent-sdk/subagents) · [platform.claude.com/docs](https://platform.claude.com/docs/en/agent-sdk/subagents)
- Headless mode / `-p` / permissions — [code.claude.com/docs/headless](https://code.claude.com/docs/en/headless) · [SFEIR: headless + CI/CD](https://institute.sfeir.com/en/claude-code/claude-code-headless-mode-and-ci-cd/)
- GitHub Actions agent — [Groundy](https://groundy.com/articles/how-to-run-claude-code-as-a-github-actions-agent-for-automated-pr-fixes/) · [mehdi.cz](https://www.mehdi.cz/blog/claude-code-ci-automation)
- Agent SDK production/tracing — [inference.net](https://inference.net/content/claude-agent-sdk-production-guide/)
