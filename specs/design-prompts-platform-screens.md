# Design prompts — platform / "true app" screens (for Claude Design)

The 24 domain screens are built. These are the missing **platform surfaces** that make Axona a real
multi-tenant SaaS: auth, onboarding, settings/admin, billing, notifications. Each block below is a
**self-contained prompt to paste into the Axona Claude Design project** (which already holds DS.1 + the v2
screens as reference) to generate that screen's `.dc.html`. Generate one at a time; then drop each export
into `design/prototypes/axona-v2/` and it becomes a 1:1 build target like the rest.

Backlog mapping: Auth = E1 (AUTH.*), Settings/admin = E9 (SET.*), Billing = E10 (BILL.*), Notifications = E11.

---

## Shared brand preamble (prepend to every prompt, or rely on the project's DS context)

> Design a new screen for **Axona — the AI-native operating system for robotics companies** — matching the
> existing v2 design set in this project. Hold the brand exactly: **Archivo** (UI/display) + **JetBrains
> Mono** (data · labels · numbers); surfaces **paper `#ffffff` / panel `#f4f3ef` / ink `#0a0a0a`**; a
> **single lime accent `#c6f24f`** used sparingly (one signal per view); functional **green `#1f9e6f`** only
> for live/approved/healthy; **no invented reds — critical/attention states render in ink**; hairlines over
> shadows; a subtle dotted-grid motif; **Lucide** icons at ~1.5px stroke only; **no emoji, ever**. Copy is
> **sentence case** with **UPPERCASE MONO eyebrows/labels**; numbers are mono + specific; "·" as separators.
> **Function-first** — lead with the screen's signature artifact, never generic-table slop. In-app screens
> use the **240px left sidebar + 60px topbar** shell; auth/onboarding screens are **full-screen (no shell)**.
> Sample org = "Axona Demo Co"; roles = ADMIN · OPS · ENGINEER · SALES · FINANCE · TECH · VIEWER; sample
> people = M. Osei, L. Sato, R. Caldwell, Priya Nair, Dana Reyes, Omar Haddad.

---

## A · Auth & onboarding (full-screen, no shell)

### 1. Log in  — `/login`
Full-screen sign-in. Centered auth card on the paper field with the dotted-grid motif; the `axona` wordmark
+ leaf mark above. Fields: work email, password (show/hide), "Log in" (ink primary button), a hairline "or"
divider, then **"Continue with SSO"** (SAML/OIDC — for enterprise robotics buyers). Below: "Forgot
password?" and "Create a workspace" links. A quiet trust line (SOC 2 / SSO). One lime accent max (the focus
ring or the primary hover). Enterprise-clean, not consumer-playful. Show the default + an inline error state
("That email or password doesn't match.") in ink.

### 2. Create a workspace  — `/signup`
Full-screen signup that provisions a new org. Two logical steps in one view (or a 2-pane): **your account**
(name, work email, password) and **your workspace** (organization name, auto-suggested workspace URL
`axona.co/axona-demo-co`, industry = Humanoid / Mobility / Industrial). Primary "Create workspace" seats the
creator as ADMIN. Reassure with a one-line "Free while in pilot · no card required." Same wordmark + dotted
grid as login. Show the filled-in happy path with "Axona Demo Co".

### 3. Reset password  — `/reset`
Full-screen, minimal. Two states stacked (the designer shows both): **request** (email field → "Send reset
link") and **confirmation** ("Check your inbox — we sent a reset link to omar@axona.co", with a resend
timer). Plus the **set-new-password** variant (new password + confirm, strength hint). Match login's card +
wordmark. Also covers the email-verification confirmation ("Email verified — you're all set").

### 4. Accept invite  — `/invite/:token`
Full-screen join flow. A card: "**M. Osei** invited you to join **Axona Demo Co** on Axona" with the org
mark + the assigned role shown as a mono pill (e.g. `OPS`). Fields: your name, set password (email
pre-filled + locked). Primary "Join Axona Demo Co". A small line on what the role can do. One lime accent on
the org mark or the join button.

### 5. Onboarding wizard  — `/onboarding`
Full-screen first-run, a **3-step stepper** (top progress: 1 Profile · 2 Team · 3 Modules). Step 1 — org
profile (name, logo upload, industry). Step 2 — **invite your team** (repeatable email + role-select rows;
the 7 roles) with a "skip for now". Step 3 — **enable modules**: the 24 modules grouped Core / Value chain /
Robotics / Back office as toggle tiles (dotted-grid tiles, lime when on), with sensible defaults on. Footer:
Back / Continue, and a "Finish → Command Center" on the last step. Function-first: the module-enablement grid
is the signature artifact.

---

## B · Settings & admin (in-shell: 240px sidebar + 60px topbar, with a settings sub-nav)

> These sit behind a **Settings area** — a left settings sub-nav (Organization · Members · Your profile ·
> Notifications · Integrations · Billing) inside the normal app shell. Design each as the content pane with
> that sub-nav visible.

### 6. Organization settings  — `/settings/org`
Org profile + configuration. Sections: **Profile** (name, logo, primary domain `axona.co`, industry),
**Branding** (accent — locked to lime by default, logo), **Defaults** (timezone, fiscal start, default role
for new members), and **Modules** — the same 24-module enable grid as onboarding but as a management list
(module · group · on/off · # agents). ADMIN-only actions. Signature artifact: the module-enablement matrix.

### 7. Members & roles  — `/settings/members`
The admin roster. **Signature artifact: a members table** — Person (avatar + name + email) · Role (the 7-role
mono pill, editable via a select) · Status (Active / Invited / Deactivated) · Last active · row actions
(change role · deactivate). Top: an "Invite people" button (opens an email + role row) and a role-filter +
search. A small legend of what each role can do (a role × capability mini-matrix is a nice secondary
artifact). Sample: Omar Haddad · ADMIN · active; M. Osei · TECH · active; Dana Reyes · SALES · active; a
pending "priya@…· ENGINEER · Invited". ADMIN-gated; VIEWER sees read-only.

### 8. Your profile & security  — `/settings/profile`
The signed-in user's own settings. Sections: **Profile** (name, avatar, email, role shown read-only),
**Password** (change: current + new + confirm, strength hint), **Sessions & devices** — a list of active
sessions (device · location · last seen · "this device" pill) with "Revoke" per row + "Sign out
everywhere". Function-first: the sessions/devices list is the signature artifact (security-forward).

### 9. Notification preferences  — `/settings/notifications`
A **channel × event matrix**: rows = event types (Approvals awaiting you · Cross-module exceptions · Agent
run failures · Weekly digest · Mentions), columns = **In-app** and **Email** toggles. A master mute + quiet
hours. Signature artifact: the preferences matrix (mono labels, lime for on). Keep it tight and scannable.

### 10. Integrations & API keys  — `/settings/integrations`
Two zones. **Integrations** — connect the systems the ontology ingests from: ERP / PLM / MES, plus Slack,
email, telemetry; each a card with status (Connected green · Not connected · Error ink) + a connect/manage
action. **SSO/SAML** — configure enterprise SSO (IdP metadata, ACS URL, a "Test" action, enforced-SSO
toggle). **API keys** — a table of keys (label · created · last used · masked value `ax_live_••••7f3c`) with
create + revoke (ADMIN-gated). Signature artifact: the integrations card grid.

---

## C · Billing (in-shell, in the Settings area)

### 11. Billing & subscription  — `/settings/billing`
Axona-as-SaaS billing the tenant (distinct from the Finance *module*). Sections: **Plan** — current plan
card (e.g. "Scale") with what's included; **Seats** — used vs total (e.g. `18 / 25 seats`) with a usage bar
+ "add seats"; **Usage & entitlements** — agent runs this cycle, modules enabled, any metered limits (mono
numbers + bars); **Payment method** — card on file `Visa ···· 4242` + update; **Invoices** — a table
(date · amount · status Paid/green · download). Signature artifact: the plan + seats summary strip, then the
invoices table. Numbers mono + specific.

### 12. Plans & upgrade  — `/settings/billing/plans`
The plan-selection / upgrade surface (also the paywall/trial-end state). A **3-tier pricing row** (e.g.
Pilot · Scale · Enterprise) as dotted-grid cards — per-tier: price, seat allowance, agent-run allowance,
modules, support, and a CTA ("Current plan" / "Upgrade" / "Talk to us" for Enterprise). Highlight the
recommended tier with the single lime accent. A trial/dunning banner variant at top ("Your pilot ends in 6
days" in ink). Function-first: the comparison cards, no generic table.

---

## D · Notifications (in-shell)

### 13. Notification center  — `/notifications`
An in-app inbox of what needs the user. **Signature artifact: a grouped activity feed** — grouped by
Today / Earlier, each row = an icon by type (approval · exception · run · mention), a one-line summary, the
source module + object (deep-link), a relative time, and an unread dot (lime). Types tie to the real spine:
"**PO-9007** awaiting your approval · Procurement", "Autonomy regression at **Site-3** · Autonomy", "Workflow
**Procurement reorder** parked · Workflows", "**M. Osei** HV/battery cert expires in 12d · People". Top:
tabs (All · Unread · Approvals) + "Mark all read". Attention states in ink, unread accent in lime. A
compact, scannable feed — not a table.

---

## Notes
- **Auth/onboarding (1–5)** are full-screen and share one auth aesthetic — design 1 first, reuse the shell
  for 2–4.
- **Settings (6–12)** share the settings sub-nav — establish it on screen 6, reuse.
- Skipped as non-design (build directly): 404/error/empty states, the account dropdown menu, email templates
  (those are React Email, not screens).
- Sequence to build after designing: AUTH.* → onboarding → SET.* → BILL.* → NOTIF.* (they gate each other
  roughly in that order; auth first since everything else assumes a session + org).
