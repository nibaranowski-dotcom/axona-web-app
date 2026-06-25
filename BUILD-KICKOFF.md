# Claude Code — Build Kickoff Prompt

Paste the block below as your first message to Claude Code in this repo.

---

You are building the **Axona Web App** — the AI-native operating system for robotics companies.

Read these first, in order, and treat them as the source of truth:
1. `CLAUDE.md` — brand invariants, stack, integrity rules, definition of done.
2. `specs/axona-build-spec.md` — the full product spec (24 modules, data model §3, agent runtime §5, API §6, frontend §7, skeleton §9).
3. `design.md` — v2 tokens (Archivo + JetBrains Mono, lime `#c6f24f` signal, paper field, no emoji, no invented reds).
4. `backlog.md` — the ordered, CPRD-ready story backlog (113 stories, 12 epics). This is your work queue.

Stack is the build-spec stack (see `backlog.md` header): pnpm + Turborepo monorepo, TypeScript strict,
Next.js 14 App Router, Tailwind + CSS-var tokens, Prisma + PostgreSQL (multi-tenant by `orgId`),
BullMQ (Redis), Auth.js + RBAC, pgvector + Postgres FTS, Claude via a thin `AgentRuntime`, S3/MinIO.

Engineering rules every story must satisfy: `orgId` on every query; mutations only via server actions /
route handlers; `requireRole()` as line 1 of any mutating action; Zod schemas for all structured AI
output with try/catch per AI call; named BullMQ steps + `Promise.allSettled` fan-out + idempotent
inserts; v2 tokens only (no raw hex); agent trace where relevant; human-in-the-loop on gated actions;
`tsc --noEmit` clean; a verify script + a `docs/manual-checks.md` entry per story.

**Start with story FND.1** (scaffold the monorepo). Do not skip ahead — follow `backlog.md` order and
respect each story's dependencies. After FND.1, stop and show me the structure before continuing.

Confirm you've read all four files and summarize the build plan for the first milestone (E0 Foundation,
stories FND.1–FND.15) in 5 lines, then begin FND.1.
