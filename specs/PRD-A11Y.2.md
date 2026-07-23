# PRD — A11Y.2 · Make the per-route a11y gate real (axe in CI)

**Story:** A11Y.2 — Run a real accessibility gate against the *served* app in CI (axe over the key routes), so
the "a11y 0 on route" line in every UI story's DoD is actually enforced instead of theater.
**Pri/size:** P1 · M. **Track:** Infra/quality. **Depth:** Condensed. **Deps:** the CI workflow (`.github/
workflows/ci.yml`), UX.8 loaders, AUTH.1 (a test login for authed routes).

## Why

`verify:a11y-1` is a **static** check (reads files for `lang`/landmarks/skip-link/contrast token). CI runs
install · lint · typecheck · verify:all · build — **none of which serve the app or run axe.** So the per-route
"a11y 0" DoD that appears in ~20 UI stories has only ever been checked by a human driving a browser (heavy,
flaky, and skipped for PLM.5). Per our own rule — *a check that skips in the environment that ships is theater*
— this gate needs to actually run where it ships.

## Goals

1. **Serve + axe in CI** — a CI job that builds, boots the app (against a CI Postgres+seed, or a static/mocked
   data mode if cheaper), signs in as the test user, and runs **axe-core** (via Playwright or `@axe-core/cli`)
   over a representative route set — including **authed** routes and at least one **PLM** route.
2. **Route set** — cover the a11y-sensitive surfaces: `/login`, `/core`, `/audit` (ReliabilityPanel), `/units`,
   `/units/:serial`, `/blast-radius`, `/agents` (agent pane open), plus one dense table route. Make the list a
   config so new routes are cheap to add.
3. **Fail on serious/critical violations** — the job fails CI on any serious/critical axe violation; moderate/
   minor are reported but don't block (tune the threshold to the existing bar). Output the violations clearly.
4. **Keep `verify:a11y-1`** (the static check) — it's fast and catches the structural class pre-serve; A11Y.2 is
   the served complement, not a replacement.

## Non-goals (flag)

Full WCAG manual audit · screen-reader testing · fixing whatever new violations the real gate surfaces (that's
follow-up stories per route). A11Y.2 stands up the *gate*; the first run may find real issues — triage them into
small per-route fixes, don't block A11Y.2 on a clean sweep unless trivial.

## Approach

- Add a CI job (or extend the gate) that spins up the app + a seeded DB (reuse `./dev.sh`'s infra pattern or a
  CI service container), runs axe over the route list authenticated as the seeded admin, and asserts zero
  serious/critical.
- Prefer Playwright (already a candidate skill) for auth + navigation + `@axe-core/playwright`.
- Wire it so it runs on push to main (and PRs). If full-serve is too slow for every push, gate it to a
  required check that can run on a cadence + pre-merge — but it MUST run before something ships, not never.

## Verify + gate (`src/scripts/verify-a11y-2.ts` + the CI job)

1. The CI job serves the app, authenticates, and runs axe over the configured routes; it fails on a seeded
   serious/critical violation (prove it catches one, then fix/allowlist).
2. The route list includes authed + PLM + agent-pane-open surfaces.
3. `verify:a11y-1` (static) still runs and passes.
CI gate: the new job is part of the required checks; install · lint · typecheck · verify:all · build stay green;
commit + push; Actions green including the new a11y job.

## Review gate

Stop after A11Y.2; show: the CI a11y job running axe over the route set, a deliberately-seeded violation failing
it (proving it's real), and the list of any genuine violations it surfaced on the current app (triage, don't
necessarily fix in this story).
