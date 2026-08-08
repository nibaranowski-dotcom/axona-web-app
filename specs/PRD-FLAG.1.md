# PRD — FLAG.1 · Feature flags (autonomy control surface) + privacy-aware analytics

**Story:** FLAG.1 — a **self-hostable feature-flag** service reached through one module, wired as the control
surface for the **TRUST.1 progressive-autonomy ladder** (gate agent autonomy per tenant/feature/module), plus
**privacy-aware product analytics** that is per-tenant opt-in and off by default for sensitive tenants.
**Type:** cross-cutting — **no route** (a flags module + evaluation hooks + a tenant setting). **Pri/size:**
P1 · M–L. **Track:** Platform / moat-adjacent (it operationalizes TRUST.1).
**Deps:** TRUST.1 (autonomy ladder), RBAC.4 `decide()` (propose→approve), CONF.1 (calibrated confidence that
thresholds gate on), FND.11 (org-scoped client / per-tenant isolation), the `AgentRuntime`.

## Why now
Grounded: no flags, no analytics in the product app (0 hits). Flags are the missing mechanism that makes the
autonomy ladder **operable** — today autonomy is a designed surface with no per-tenant switch. Analytics is
table-stakes ops, but it carries a real constraint the generic boilerplate ignores: **enterprise/defense tenants
will not accept third-party session-replay on operational data.**

## Approach

### Flags (the load-bearing half)
- **One module** — `apps/web/lib/flags.ts`: `isEnabled(flag, { orgId, userId })`, server-side, **org-scoped**
  (org A's flag state never resolves for org B — assert isolation). Self-hostable provider (Unleash / Flagsmith
  / PostHog-self-host) so it runs in-VPC; nothing else imports the SDK.
- **Wire TRUST.1 to flags:** per-tenant, per-module autonomy scope is a flag the org controls — e.g.
  `autonomy.<module>.<kind>` moves an agent from **propose-only** → **auto-approve under a CONF.1 confidence
  threshold**. The `decide()` path reads the flag + threshold before auto-acting; default is the most
  conservative rung (propose-only). This is the designed, measured autonomy surface — not an implicit toggle.
- **Kill-switch semantics:** a flag flip is immediate and audited (AUDIT.1) — turning autonomy down never
  requires a deploy. Money/safety/contract kinds stay human-gated regardless of flag state (guardrail floor).

### Analytics (the privacy-gated half)
- `capture(orgId, userId, event, props)` — server-side, **gated by a per-tenant setting** (`analyticsEnabled`,
  default **off** for tenants flagged sensitive; opt-in otherwise). Self-host option for the whole pipeline.
- **Never send operational marque data to a third party (SEED.1):** event props go through an **allowlist** +
  the banned-marque scanner; distinct-id is an opaque tenant/user hash, never the marque. No session replay on
  in-product operational screens.

## Verify + gate
- `verify-flag-1.ts`: (1) flags evaluate per-org — org A's flag does not leak into org B's evaluation;
  (2) the TRUST.1 gate honors the flag — a tenant with `autonomy.*` off gets **propose-only** through
  `decide()`, even above the confidence threshold; (3) money/safety/contract kinds stay human-gated regardless
  of flag; (4) analytics respects the per-tenant opt-out — a sensitive tenant emits **zero** events, and any
  emitted event's props pass the SEED.1 marque scan with an opaque distinct-id. Self-cleaning. Add to
  `verify:all`. `docs/manual-checks.md` entry.

## DoD
Per-org flag evaluation (isolated); the TRUST.1 autonomy ladder is gated by flags with a conservative default
and an immediate audited kill-switch; money/safety/contract remain human-gated; analytics is per-tenant opt-in,
off by default for sensitive tenants, marque-scrubbed with opaque ids, self-hostable; nothing imports the flag/
analytics SDK except the module; `tsc --noEmit` clean; `verify:all` green.
