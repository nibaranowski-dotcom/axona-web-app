# PRD — AUTH.6 · Onboarding wizard (+ AUTH.3 post-auth routing)

**Story:** AUTH.6 — Onboarding wizard (org profile · invite team · enable modules), folding in AUTH.3
(new-org → onboarding, onboarded/existing → Command Center).
**Spec ref:** `specs/axona-build-spec.md` §8; backlog E1 rows 18 (AUTH.3) + 21 (AUTH.6).
**Priority / size:** P1 · M (3 dev-days). **Track:** Platform (E1). **Depth:** Full CPRD.
**Dependencies:** AUTH.1 (session), AUTH.4 (signup already redirects new ADMINs to `/onboarding`, a thin
redirect to `/core` today). Design: `design/prototypes/axona-v2/Onboarding.dc.html` (imported).

---

## 1. Context — what exists

- **AUTH.4** provisions a new Org + ADMIN and redirects to `/onboarding` (currently a thin redirect to `/core`,
  `/// AUTH.6` seam). `Org` now has `name, slug, industry`.
- **Modules are GLOBAL** (no orgId) — the nav (`getNavModules`) lists all 22. There is **no per-org module
  enablement** and **no onboarding-completion flag** yet — both are added here.
- A new org is **empty** (no per-org data/agents). The demo org (seed) has full data.

## 2. Goals

1. `/onboarding` built 1:1 to `Onboarding.dc.html` — a **3-step wizard**: (1) org profile, (2) invite team, (3)
   enable modules — persisting the choices and finishing into the Command Center.
2. **Per-org module enablement** — a new org (via the wizard) chooses which modules are on; the sidebar nav respects it.
3. **AUTH.3 routing** — after auth, a not-yet-onboarded org's ADMIN lands on `/onboarding`; everyone else on `/core`.

## 3. Non-goals (explicit)

- **Full invite/accept** → AUTH.5. The wizard's invite step is **"skip for now"** by default; if the user adds
  teammates it collects them but does NOT create live invites yet (flag — wiring to real invites lands with AUTH.5).
- **Editing enablement later** → SET.1 (org settings reuses the same `enabledModules`).
- **Default per-org agent/data provisioning** — still deferred (a new org stays empty until used).

## 4. Data model

Bounded additions via `prisma migrate dev` (NEVER db push):
- `Org.onboardedAt DateTime?` — null until the wizard is finished (the routing flag).
- `Org.enabledModules String[]` — the enabled module `key`s. Null/empty ⇒ treat as **all** (back-compat for the
  demo org). Default on a fresh org before onboarding = all; the wizard writes the chosen subset.
`prisma migrate status` clean; FTS/pgvector intact.

## 5. The wizard (`/onboarding`, 1:1 to Onboarding.dc.html)

Full-screen, 3-step stepper (progress 1 Profile · 2 Team · 3 Modules), ADMIN/owner-gated, org-scoped server actions:
- **Step 1 — Profile:** org name, industry (prefilled from signup), optional logo. Saves to `Org`.
- **Step 2 — Team (skip-first):** repeatable email + role rows (the 7 roles) with a prominent "Skip for now".
  Collect only — do NOT persist live invites (AUTH.5). If skipped/empty, no-op. Flag the deferral in the UI copy
  softly (or just present it as optional).
- **Step 3 — Modules:** the 24 modules grouped Core / Value chain / Robotics / Back office as toggle tiles
  (dotted-grid, lime when on), sensible defaults on. Writes `Org.enabledModules`. This is the signature artifact.
- **Finish:** set `Org.onboardedAt = now()`, redirect to `/core`. Idempotent — hitting `/onboarding` after
  completion redirects to `/core`.

## 6. Nav respects enablement

- `getNavModules` (or the sidebar) filters to `Org.enabledModules` (null/empty ⇒ all — so the demo org and any
  pre-existing org are unaffected). A disabled module is hidden from the sidebar; a direct hit to a disabled
  module's route renders a graceful "module not enabled" state (or redirects to `/core`) — don't 500.

## 7. AUTH.3 routing (folded in)

- After login/signup, resolve the landing: if the acting user is an **ADMIN of an org whose `onboardedAt` is null**
  → `/onboarding`; otherwise → `/core`. Non-ADMINs of a not-yet-onboarded org → `/core` (they don't run onboarding).
- Implement in the post-auth redirect (the auth callback / a small server check in the shell layout or middleware),
  not the client. `/onboarding` itself guards: onboarded org → `/core`.
- **Seed:** set the demo org's `onboardedAt` (so demos skip the wizard) and `enabledModules = all`.

## 8. Tenancy · guardrails (DoD-blocking)

- Wizard actions are **ADMIN/owner-gated** (`requireRole`) + org-scoped (`dbForOrg`); a non-ADMIN can't run it.
- No cross-org: the wizard only ever writes the acting user's own Org.
- v2 tokens, no emoji, no invented reds; Lucide icons; the module grid matches the design.

## 9. Verification + gate

- `src/scripts/verify-auth-6.ts` (DB-gated; pure-logic always runs):
  1. `Org.onboardedAt` + `enabledModules` exist; migrate status clean.
  2. Finishing the wizard sets `onboardedAt` and writes the chosen `enabledModules`; re-visiting `/onboarding` for an
     onboarded org redirects to `/core`.
  3. Routing: a fresh (onboardedAt-null) org's ADMIN routes to `/onboarding`; an onboarded org routes to `/core`; a
     non-ADMIN routes to `/core`.
  4. `getNavModules` returns only enabled modules (and ALL when `enabledModules` is null/empty — demo org unaffected).
  5. A disabled module's route renders the graceful not-enabled state (no 500).
  6. Wizard actions are ADMIN-gated + org-scoped (a VIEWER/cross-org call is rejected).
- `docs/manual-checks.md`: sign up → land on the wizard → set profile, skip team, toggle modules off → finish →
  Command Center with the disabled modules hidden from nav; the demo login skips onboarding.
- **CI gate:** `pnpm install --frozen-lockfile && pnpm lint --force && pnpm typecheck --force && pnpm verify:all` +
  **`pnpm build` compiles**; migrate status clean; commit + push; confirm GitHub Actions green.

## 10. Review gate

**Stop after AUTH.6** and show me: (a) the migration + the wizard's finish action, (b) a fresh signup landing on the
3-step wizard and finishing into the Command Center, (c) a module toggled off in step 3 hidden from the sidebar, (d)
the demo login skipping onboarding (onboardedAt set), and (e) verify-auth-6 output — before continuing.

---

### Completeness check (6-point)
1. Story + spec ref — AUTH.6 (+AUTH.3), §8, E1 rows 18/21. ✓
2. Every requirement — wizard 3 steps, module enablement, onboarding flag, routing, nav filter. ✓
3. DoD — ADMIN-gated + org-scoped, verify + manual-checks, tsc + build clean, CI gate, migrate clean. ✓
4. Real deps — AUTH.1/4, Onboarding.dc.html. ✓
5. Flags — invite step skip-only (AUTH.5), enablement reused by SET.1, empty-org/default-provisioning deferred. ✓
6. Review gate — §10. ✓
