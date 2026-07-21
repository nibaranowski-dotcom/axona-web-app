# PRD — LOGIN.1 · Diagnose and fix the recurring `/login` 500

**Story:** LOGIN.1 — Find the actual cause of the intermittent 500 on `/login` and fix it (or prove it's
environmental and make it impossible to mistake for a product bug).
**Pri/size:** P0 · S. **Track:** Platform/bugfix. **Depth:** Condensed. **Deps:** AUTH.1 (credentials/session),
FND.13 (shell), UX.8 (loading states).

## The problem

`/login` has returned a 500 at least three times across sessions, including **after a clean `./dev.sh`
restart**. Each time it was attributed to "dev-server staleness" (`next-error: not-found`), worked around by
opening a fresh browser tab, and never diagnosed. CI builds the same commits green, and authenticated routes
render fine — so it presents as environmental. But:

- **It is the first screen anyone sees.** A 500 on the login route during a live investor or prospect demo is
  the worst possible first impression, and "just open a new tab" is not something you can do in front of a room.
- It has now recurred **after** a fresh restart, which is the condition we said would make it real rather than
  stale-process noise.
- Three anecdotes with the same symptom is a pattern, not flakiness.

## Goal

Determine the **actual** root cause and fix it. If — after real evidence — it is genuinely a dev-only artifact
(e.g. a Next dev module-graph/`not-found` interaction, a stale `.next` cache, or an unauthenticated-fetch path
that only mis-renders in dev), then make it **non-recurring and non-confusable**: eliminate the trigger, or
make the failure surface an honest error state instead of a 500.

## Investigate before fixing (do not guess)

1. **Reproduce deterministically.** Fresh `./dev.sh` (no stale server on 3001 — confirm the port was free),
   then hit `/login` **unauthenticated** via curl AND a clean browser profile. Capture the full server stack
   trace, not just the status code.
2. **Isolate the layer.** Does it reproduce in a production build (`pnpm build && pnpm start`)? If prod is
   clean and dev is not, that localises it to the dev server; if prod also 500s, it's a real product bug and
   takes priority.
3. **Check the usual suspects, with evidence for each:** the `next-error: not-found` interaction with the
   root/`(shell)` layouts; middleware behaviour on the public `/login` route (it's excluded from auth — verify
   it actually is, in every matcher branch); the root `loading.tsx` / `FullScreenLoader` path (UX.8) rendering
   pre-session; any server component on `/login` touching a session/db call that throws when there's no session;
   a stale `.next` cache surviving restarts.
4. **State the conclusion with the evidence**, then fix the actual cause.

## Fix requirements

- If it's a product bug → fix it, and add the failing condition to the verify script.
- If it's genuinely dev-only → remove the trigger (e.g. clear the stale-cache path, correct the layout/middleware
  interaction), and ensure `/login` **cannot return a 500** for an unauthenticated request: any failure must
  render the designed error state, never an unhandled 500.
- Do **not** "fix" it by documenting a workaround. A fresh tab is not a fix.

## Verify + gate (`src/scripts/verify-login-1.ts`)

1. `/login` returns **200** for an unauthenticated request on a cold start (assert the status, not just that a
   page exists).
2. The route has no unhandled-throw path: a forced failure in its data path renders the error state, not a 500.
3. Middleware treats `/login` as public in every matcher branch (assert, don't assume).
4. Existing AUTH.1 verifies stay green; sign-in still works end-to-end.
CI gate: install --frozen-lockfile · lint · turbo typecheck · verify:all · **pnpm build** · a11y 0 on `/login`;
commit + push; Actions green.

**Live acceptance:** cold `./dev.sh`, brand-new browser profile, navigate straight to `http://localhost:3001/login`
→ the login screen renders first time, repeatedly (try it 3× including one hard reload), with no 500 in the
server log.

## Review gate

Stop after LOGIN.1; show: the reproduction + the captured stack trace, the stated root cause **with evidence**,
the fix, and three consecutive clean cold loads of `/login`.
