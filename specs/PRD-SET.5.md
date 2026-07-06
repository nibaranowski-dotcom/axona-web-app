# PRD — SET.5 · Integrations, SSO config & API keys

**Story:** SET.5 — Integrations & SSO config + API keys (encrypted at rest).
**Spec ref:** §gap; backlog E9 row 103. **Pri/size:** P2 · M. **Track:** Platform (E9). **Depth:** Full CPRD.
**Deps:** AUTH.1, SET.2 (sub-nav), AUDIT.1. Design: `Settings - Integrations.dc.html`.

## Goals
`/settings/integrations` (1:1 to the design, shell + sub-nav), three zones:
1. **Integrations** — connect cards for the ontology's ingest sources (ERP · PLM · MES) + Slack/email/telemetry, each
   with a status (Connected/green · Not connected · Error/ink) + connect/manage. **Connect flows are stubbed** here
   (real connectors = CONN.1) — the cards + status model are real; "connect" opens a stub/"coming soon" — flag.
2. **SSO/SAML** — a config surface (IdP metadata, ACS URL display, enforce-SSO toggle) — **stubbed/config-only**;
   real SSO auth = AUTH.2 (flag).
3. **API keys** — a real table: create (returns the key ONCE), list (masked `ax_live_••••7f3c`), revoke. Keys are
   **hashed at rest** (store a hash + a short prefix for display), never retrievable again.

## Non-goals
Real connector ingest → CONN.1. Real SSO/SAML auth → AUTH.2. Webhooks → later. API-key *usage/scoping/enforcement*
beyond create/list/revoke → later (flag).

## Data model (via `prisma migrate dev`, never db push)
- `Integration` `{ id, orgId, kind (ERP|PLM|MES|SLACK|EMAIL|TELEMETRY|…), status (NOT_CONNECTED|CONNECTED|ERROR),
  config Json?, connectedAt? }`.
- `ApiKey` `{ id, orgId, name, prefix (display, e.g. ax_live_7f3c), keyHash (bcrypt/sha256 of the full key),
  createdById, createdAt, lastUsedAt?, revokedAt? }`. **Never store the plaintext key.**
- `SsoConfig` `{ id, orgId @unique, provider?, idpMetadata Json?, enforce Boolean @default(false), updatedAt }`.
  migrate clean.

## Read model + actions (ADMIN-gated, org-scoped, audited)
- `getIntegrations(orgId)`, `getApiKeys(orgId)` (masked), `getSsoConfig(orgId)`.
- `createApiKey(name)` → generate a random key, store `keyHash`+`prefix`, **return the plaintext ONCE** (shown then
  gone). Audit `apikey.create`. `revokeApiKey(id)` → set revokedAt, audit `apikey.revoke`.
- `updateSsoConfig(...)` → store config (no live auth), audit `sso.config_change`.
- Integration connect/disconnect = **stubbed** (set status, audit `integration.status_change`) — flag no real ingest.

## Screen
Shell + Settings sub-nav (Integrations). Integrations card grid (status badges), SSO config form, API-keys table
(create modal shows the key once with a copy button + "you won't see this again" warning). ADMIN-only writes;
non-ADMIN read-only. v2 tokens, no emoji, no invented reds (ERROR renders in ink).

## Guardrails
ADMIN-gated; org isolation; **API keys hashed at rest, plaintext shown once, never logged**; SSO/integration writes
are config-only (no real auth/ingest) — flagged; every write audited.

## Verify + gate (`src/scripts/verify-set-5.ts`)
1. Integration/ApiKey/SsoConfig models; migrate clean.
2. createApiKey stores a hash+prefix (NOT plaintext), returns the plaintext once; getApiKeys shows masked only;
   revokeApiKey sets revokedAt; all audited; VIEWER forbidden.
3. getIntegrations/getSsoConfig org-scoped; updateSsoConfig persists config + audits.
4. Cross-org keys/config not readable; plaintext key never present in the DB or logs.
CI gate: install·lint·typecheck·verify:all·**pnpm build**·migrate clean·a11y 0 on /settings/integrations; commit+push; green.

## Review gate
Stop after SET.5; show: the models; creating an API key (shown once) + the masked list + revoke, each audited; the
integrations grid + SSO config (stubbed); verify-set-5 output.
