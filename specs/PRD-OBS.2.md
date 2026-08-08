# PRD — OBS.2 · Error + exception tracking (web · worker · agent runtime)

**Story:** OBS.2 — add production error/exception tracking across all three server entry points (the Next.js web
app, the BullMQ worker, and the `AgentRuntime`), through **one monitoring module** — nothing else imports the
SDK. **Self-hostable** so it deploys inside a tenant VPC (own-your-stack GTM). Closes the "unattended worker with
no error tracking is a time bomb" gap — the BullMQ agents/workflows currently run on Railway with **zero**
exception visibility.
**Type:** cross-cutting ops — **no route**. **Pri/size:** P1 · M. **Track:** Ops/observability.
**Deps:** the BullMQ worker (`apps/worker` / the queue consumers), the Next.js app, `AgentRuntime`; Railway
runtime env; the SEED.1 anonymization scanner (`src/scripts/lib/anonymization.ts`).
**Relationship to OBS.1:** complementary, not a substitute. OBS.1 (Langfuse) traces **agent runs**; OBS.2
captures **web/worker/server exceptions**. Different failure surfaces; both feed ops, neither is the immutable
audit log.

## Why now
Grounded: `@sentry/*` appears in **0 files**. The worker (agents · workflows · file/matrix queues) is the most
exposed — it runs unattended, and a swallowed exception there is invisible today. Error tracking is the eyes on
that surface.

## Approach (one module, initialized at every entry point)
- **One module** — `apps/web/lib/monitoring.ts` (or `packages/db`-adjacent shared): `initMonitoring()` +
  `report(err, ctx)`. Use a **self-hostable** provider (Sentry self-hosted or GlitchTip — Sentry-SDK-compatible),
  so it can run in-VPC. Nothing else imports the SDK.
- **Init at each entry point, monitoring first:** the worker's `main()` (before any queue consumer), the Next.js
  server instrumentation hook (`instrumentation.ts` / `@sentry/nextjs`), and the `AgentRuntime` boot. Register
  `unhandledRejection` / `uncaughtException` handlers and a **BullMQ `failed`-job handler** that calls `report`.
- **Fail-safe:** no DSN configured → `initMonitoring()` is a clean no-op (dev + tests never emit). Modest
  `tracesSampleRate` (~0.1).
- **Anonymization is mandatory (SEED.1):** error payloads (messages, stack frames, `ctx`) can carry tenant
  data — **scrub before send**: run the serialized event through the SEED.1 banned-marque scanner and drop/redact
  any hit; strip `orgId`-linked PII to an opaque tenant hash. A leaked marque in an error report is the same
  unrecoverable mistake as one on screen.
- **Per-tenant isolation:** tag events with an opaque tenant hash (never the marque); for VPC tenants the
  provider is deployed in their environment, so their errors never leave it.

## Verify + gate
- `verify-obs-2.ts`: (1) a thrown error in the **worker** and in a **web** handler is captured by the module
  (assert against a mock/in-memory transport, no live DSN); (2) `initMonitoring()` is invoked at each entry point
  (worker main, web instrumentation, runtime boot); (3) **no DSN → zero emissions** (no-op contract);
  (4) a payload containing a banned marque is **scrubbed** before it reaches the transport (reuse the SEED.1
  scanner on the serialized event) — this is the load-bearing assertion. Self-cleaning. Add to `verify:all`.
  `docs/manual-checks.md` entry (force an error in each entry point; confirm capture + scrub).

## DoD
Web, worker, and agent runtime all report unhandled exceptions through the one module; no-DSN is a clean no-op;
every event is marque-scrubbed (SEED.1) and tenant-tagged by opaque hash; provider is self-hostable/VPC-ready;
`tsc --noEmit` clean; `verify:all` green. Nothing imports the monitoring SDK except the module.
