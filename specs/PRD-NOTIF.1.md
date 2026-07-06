# PRD — NOTIF.1 · Notification model + in-app notification center

**Story:** NOTIF.1 — Notification model + in-app notification center.
**Spec ref:** §gap; backlog E11 row 110. **Pri/size:** P1 · M. **Track:** Platform (E11). **Depth:** Full CPRD.
**Deps:** AUTH.1, FND.11, RBAC.4/AUDIT.1 (sources of notable events), the through-line seed. Design:
`Notifications.dc.html`.

## Goals
1. A `Notification` model + `notify()` writer (org + user scoped).
2. `/notifications` (1:1 to Notifications.dc.html): a **grouped activity feed** (Today/Earlier) of what needs the
   user — approvals awaiting them, cross-module exceptions, run failures, mentions — with unread state + deep-links.
3. A small **unread badge** surfaced in the shell (topbar/sidebar) reading the count.

## Non-goals
**Wiring every source** exhaustively → NOTIF.2. **Per-channel (email) routing** → NOTIF.3 (+ EMAIL.1). Digest email
→ EMAIL.2.

## Data model (via `prisma migrate dev`, never db push)
- `Notification` `{ id, orgId, userId String? (null = whole-org/role broadcast), type (enum: APPROVAL | EXCEPTION |
  RUN | MENTION | SYSTEM), title, body, targetType, targetId, url (deep-link), readAt DateTime?, createdAt }`
  + `@@index([orgId, userId, createdAt])`. migrate clean.

## Read model + writer + actions (`apps/web/lib/notifications.ts`)
- `notify({ orgId, userId?, type, title, body, target, url })` — the only writer; org-scoped.
- `getNotifications(orgId, userId, {cursor})` — the user's notifications (their `userId` OR org/role broadcasts they
  should see), newest-first, grouped Today/Earlier; + `unreadCount`.
- Actions (own-user, org-scoped): `markRead(id)`, `markAllRead()`.
- **Wire a few real sources** (the rest is NOTIF.2): an approval parked at a gate (RBAC.4/WF gate → `notify` type
  APPROVAL to the approver role/ADMINs), and the Command Center's cross-module exceptions (type EXCEPTION). Keep each
  call one line at the source; leave `/// NOTIF.2` seams for the others.

## Screen
`/notifications` in the shell (CORE-route → global Axona pane stays). Grouped feed: per row an icon by type, a
one-line summary, source module + object (deep-link to /procurement, /workflows/:id, /people, …), relative time,
unread dot (lime). Tabs: All · Unread · Approvals. "Mark all read". Attention in ink, unread accent lime. Not a
table — a scannable feed. The shell shows an unread badge.

## Guardrails
Org isolation (a user only sees their org's notifications + their own/broadcasts); read-only content (markRead is the
only mutation); no invented reds; v2 tokens; no emoji.

## Verify + gate (`src/scripts/verify-notif-1.ts`)
1. Notification model + index; migrate clean.
2. notify writes org-scoped; getNotifications returns the user's + broadcasts, grouped, with unreadCount, org-scoped
   (no other org).
3. markRead/markAllRead set readAt (own-user only; cross-user rejected).
4. A parked approval creates an APPROVAL notification to the approver; a seeded EXCEPTION renders + deep-links.
5. The through-line seed populates the feed (PO-9007 awaiting approval, Site-3 regression, Osei cert, …).
Seed 10–20 notifications across the through-line.
CI gate: install·lint·typecheck·verify:all·**pnpm build**·migrate clean·a11y 0 on /notifications; commit+push; green.

## Review gate
Stop after NOTIF.1; show: the model + notify/getNotifications; /notifications grouped feed with an unread badge + a
deep-linked approval item; markAllRead working; verify-notif-1 output.
