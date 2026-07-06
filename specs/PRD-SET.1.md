# PRD — SET.1 · Organization settings

**Story:** SET.1 — Org settings (profile · branding · defaults · module enablement) — ADMIN-gated.
**Spec ref:** `specs/axona-build-spec.md` §8; backlog E9 row 99.
**Priority / size:** P1 · M (2–3 dev-days). **Track:** Platform (E9). **Depth:** Full CPRD (org-config admin
surface; second Settings screen, reuses the SET.2 sub-nav).
**Dependencies:** AUTH.1 (session/RBAC), AUTH.4 (Org.slug/industry), AUTH.6 (Org.enabledModules + nav filter),
AUDIT.1 (writeAudit), SET.2 (the Settings sub-nav), FILE.1 (storage, for the logo). Design:
`design/prototypes/axona-v2/Settings - Organization.dc.html` (imported).

---

## 1. Context — what exists

- **Org** { id, name, slug @unique, industry, onboardedAt, enabledModules String[] } (from AUTH.4/AUTH.6).
- **AUTH.6** already stores `enabledModules` and filters the sidebar nav by it (this screen is the management surface
  for the same data — the onboarding wizard set it once; here an ADMIN edits it anytime).
- **SET.2** established `/settings/*` + the Settings sub-nav (Organization · Members · …). **FILE.1** storage
  (`putObject`) exists for the logo. **AUDIT.1** `writeAudit`.

## 2. Goals

1. `/settings/org` (Organization tab) built 1:1 to `Settings - Organization.dc.html`, in the shell + Settings sub-nav.
2. **Profile** (name, industry, logo), **Branding** (logo + the fixed lime accent), **Defaults** (timezone, fiscal
   start, default role for new members), and **Module enablement** (the same toggle grid as onboarding, editing
   `enabledModules` live — the nav updates).
3. All writes **ADMIN-gated, org-scoped, audited**.

## 3. Non-goals (explicit)

- **Members admin** → SET.2. **Your profile/security** → SET.3. **Billing** → BILL.*. **Integrations/SSO/API keys**
  → SET.5. **Notification prefs** → SET.4.
- **Changing the workspace slug** — read-only display here (slug changes break the workspace URL; defer to a dedicated
  flow, flag). Editable: name, industry, logo, defaults, modules.
- **Custom accent/theme** — the brand is a single lime accent; branding here = logo only (accent shown, not editable).

## 4. Data model

Bounded additions to Org via `prisma migrate dev` (NEVER db push) — only what the design needs:
- `Org.logoKey String?` — the logo blob key (uploaded via FILE.1 storage; rendered via a URL). If the logo upload is
  heavier than the design warrants, it's acceptable to defer the logo to a follow-up and ship the text fields — flag.
- `Org.timezone String?` (IANA, e.g. `America/Detroit`), `Org.fiscalYearStartMonth Int?` (1–12), `Org.defaultMemberRole Role?`.
`Org.enabledModules` already exists (no change). `prisma migrate status` clean; FTS/pgvector intact.

## 5. Read model + actions (`apps/web/lib/org-settings.ts` + actions)

- `getOrgSettings(orgId)` — org-scoped: name, slug (read-only), industry, logo URL, timezone, fiscalYearStartMonth,
  defaultMemberRole, and `enabledModules` (with the full 24-module list grouped Core/Value chain/Robotics/Back office
  so the grid can render on/off).
- Actions — **ALL `requireRole(["ADMIN"])` line 1 + org-scoped + `writeAudit`**:
  - `updateOrgProfile({ name, industry, logo? })` → validate (Zod), upload the logo via FILE.1 storage → `logoKey`.
    Audit `org.profile_change`.
  - `updateOrgDefaults({ timezone, fiscalYearStartMonth, defaultMemberRole })` → validate. Audit `org.defaults_change`.
    (`defaultMemberRole` is the role prefilled for new invites — ties to SET.2/AUTH.5.)
  - `setEnabledModules(keys)` → write `Org.enabledModules` (same shape AUTH.6 wrote); the sidebar nav reflects it.
    Guard: keep at least the Core modules on (or per the design) so the app isn't unusable — flag the rule. Audit
    `org.modules_change`.

## 6. Screen (`/settings/org`, 1:1 to Settings - Organization.dc.html)

- In the shell; the SET.2 Settings sub-nav with **Organization** active. Sections per the design: **Profile** (name,
  industry select, logo upload/preview), **Branding** (logo, the lime accent shown as fixed), **Defaults** (timezone,
  fiscal-start, default role select), **Modules** (the 24-module toggle grid grouped by area, lime-on, per-group
  counts — editing `enabledModules`).
- ADMIN sees editable controls; non-ADMIN read-only (server-enforced). Save per section (or one save) per the design.
- v2 tokens, no emoji, Lucide icons, no invented reds; the module grid matches the onboarding grid's styling.

## 7. Tenancy · guardrails (DoD-blocking)

- ADMIN-gated writes (requireRole line 1); org isolation (only your Org); every save audited (visible on `/audit`).
- Module-enablement keeps the app usable (Core stays on, or per the design) — no way to lock yourself out of nav.
- Logo upload reuses FILE.1 storage under an org-scoped key; validate type/size; no arbitrary file exec.

## 8. Verification + gate

- `src/scripts/verify-set-1.ts` (DB-gated; pure-logic always runs):
  1. Org.logoKey/timezone/fiscalYearStartMonth/defaultMemberRole exist; migrate clean.
  2. `getOrgSettings` returns the profile + defaults + the full module grid with correct on/off from `enabledModules`,
     org-scoped.
  3. `updateOrgProfile` (ADMIN) updates + audits `org.profile_change`; a VIEWER is forbidden.
  4. `updateOrgDefaults` persists timezone/fiscal/defaultRole + audits.
  5. `setEnabledModules` writes enabledModules (nav reflects it) + audits; the Core-stays-on guard holds.
  6. Non-ADMIN can't write; cross-org rejected.
- `docs/manual-checks.md`: as ADMIN edit the org name + toggle a module off (it disappears from nav) + set a default
  role; see the changes in `/audit`; a non-admin sees the page read-only.
- **CI gate:** `pnpm install --frozen-lockfile && pnpm lint --force && pnpm typecheck --force && pnpm verify:all` +
  **`pnpm build` compiles**; migrate status clean; accessibility-review = 0 on `/settings/org`; commit + push;
  confirm GitHub Actions green.

## 9. Review gate

**Stop after SET.1** and show me: (a) the migration + org-settings read model, (b) `/settings/org` with profile /
defaults / module grid under the Settings sub-nav, (c) toggling a module off updating the sidebar nav + landing in
`/audit`, (d) a non-admin seeing it read-only, and (e) verify-set-1 output — before continuing.

---

### Completeness check (6-point)
1. Story + spec ref — SET.1, §8, E9 row 99. ✓
2. Every requirement — profile, branding, defaults, module enablement, settings sub-nav. ✓
3. DoD — ADMIN-gated, org isolation, audited, verify + manual-checks, tsc + build clean, CI gate, migrate clean. ✓
4. Real deps — AUTH.1/4/6, AUDIT.1, SET.2, FILE.1, Settings - Organization.dc.html. ✓
5. Guardrails flagged — least-privilege, isolation, keep-app-usable module guard, logo upload safety, audit; slug/accent/other-settings scoped out. ✓
6. Review gate — §9. ✓
