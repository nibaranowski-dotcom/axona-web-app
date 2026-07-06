# PRD — SET.4 · Notification preferences

**Story:** SET.4 — User notification preferences (channels + per-event opt-in).
**Spec ref:** §gap; backlog E9 row 102. **Pri/size:** P1 · S. **Track:** Platform (E9). **Depth:** CPRD (condensed).
**Deps:** AUTH.1, SET.2 (Settings sub-nav), NOTIF.1 (event types). Design: `Settings - Notifications.dc.html`.

## Goals
`/settings/notifications` (1:1 to the design, shell + sub-nav): a **channel × event matrix** the user controls — rows
= event types (Approvals awaiting you · Cross-module exceptions · Agent run failures · Weekly digest · Mentions),
columns = **In-app** and **Email** toggles; plus a master mute + quiet hours. Feeds NOTIF.3 routing later.

## Non-goals
Actually *routing* per preference (esp. email) → NOTIF.3 (+ EMAIL.1). The screen stores the prefs; NOTIF.1 already
respects in-app; email honoring is NOTIF.3 (flag).

## Data model (via `prisma migrate dev`, never db push)
- `NotificationPref` `{ id, userId @unique, orgId, prefs Json (map event→{inApp:bool, email:bool}), muted Boolean
  @default(false), quietStart String?, quietEnd String?, updatedAt }`. Sensible defaults (approvals/exceptions on).
  migrate clean.

## Read model + action
- `getNotificationPrefs(userId)` — own prefs (defaults if none). `updatePrefs(prefs, muted, quiet)` — own-user,
  org-scoped, Zod. (No audit needed — personal preference; optional `user.prefs_change` audit if trivial.)

## Screen
Shell + Settings sub-nav (Notifications active). The event×channel matrix (mono labels, lime for on), master mute,
quiet-hours inputs. Tight + scannable. Own-user only.

## Guardrails
Own-user only; org-scoped; NOTIF.1's in-app feed respects `inApp`+`muted`+quiet-hours now; email column stored but
honored in NOTIF.3 (flag in copy or a tooltip). v2 tokens, no emoji.

## Verify + gate (`src/scripts/verify-set-4.ts`)
1. NotificationPref model; migrate clean; defaults applied when none.
2. updatePrefs persists the matrix + mute + quiet (own-user; cross-user rejected).
3. NOTIF.1 getNotifications respects inApp=false / muted (that type suppressed in-app).
CI gate: install·lint·typecheck·verify:all·**pnpm build**·migrate clean·a11y 0 on /settings/notifications; commit+push; green.

## Review gate
Stop after SET.4; show: the model + the matrix screen; toggling an event off suppressing it in-app; verify-set-4 output.
