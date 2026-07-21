# PRD — HOUSE.1 · Housekeeping: backlog reconcile · PLM-as-module note · verify residue

**Story:** HOUSE.1 — Close three accumulated debts: a stale `backlog.md`, a CLAUDE.md that doesn't mention the
PLM module decision, and verify scripts that leave junk rows in the demo data.
**Pri/size:** P1 · S. **Track:** Housekeeping. **Depth:** Condensed. **Deps:** none.

## Why

Twenty-odd stories have shipped off PRDs + a live task list while `backlog.md` — which **CLAUDE.md instructs
every session to "work in order"** — has gone stale. Claude Code reads CLAUDE.md and the backlog fresh each
session, so a stale backlog and an unrecorded strategic decision are not cosmetic: they actively mislead the
next session.

## 1 · Reconcile `backlog.md` with reality

- Mark **shipped** everything that actually landed and isn't reflected: `DEMO.1–4`, `UX.10`, `UX.11`, `UX.12`,
  `UX.13`, `A11Y.1`, `SRCH.6`, `SEED.1`, `ONT.1`, `MEM.1`, `MEM.1a`, `CONF.1`, `PROSPECT.1`, `PROSPECT.2`,
  `PROSPECT.2a`, `GIT.1`, `AGT.2`, `DESIGN.2`. Derive the real list from `git log` — don't trust this
  enumeration; **reconcile against the commit history** and report anything I've missed.
- Add the **PLM program** rows (PLM.1a/1b, PLM.2–10, PLM.V1–V6) in the agreed order, marked not-started, with
  the stop point after the commercial slice noted.
- Add the still-open rows: `LOGIN.1`, `GOLIVE.1` (Resend — config, no code), `GOLIVE.2` (Railway), `GOLIVE.3`/
  `BILL.1` (Stripe — a build, not config), `TRUST.1`, `LOOP.1`, `MEM.2`, `MEM.3`, `ONT.3`, `TEL.1`.
- Keep the existing format; don't restructure the file.

## 2 · Record the PLM decision in CLAUDE.md — **without changing the wedge**

The CRO ruling (2026-07-20): **the wedge stays Procurement.** PLM is built as a **module (domain #15,
Engineering/PLM)** on the same spine — not a pivot, not a replacement.

- **Do NOT** alter the existing `Wedge = Procurement` lines (§ one-line, § moat invariants). They stand.
- **Add** a short note (in the PLM/Engineering context) that: PLM ships as a module; the build is split into a
  commercial slice (PLM.1a + registry/unit/diff/blast-radius/capture) and a deferred tier gated on buyer
  evidence; and **`Unit` is the billing meter** (per-module pricing metered by units under management).
- **Add** the copy guardrail: never lead with a category word in-product or in cold copy — engineering-facing
  is "configuration management and traceability," business-facing is "the operating system for how robotics
  companies run." Also: don't lead with AI on the core PLM pain (customers read these as data/plumbing problems).
- Keep it tight — a few lines in the right sections, not a new essay.

## 3 · Stop verify scripts leaving residue in the demo data

Verify runs leave **~3 agent-draft $0 purchase-order rows** behind, so Procurement reads **14 POs instead of
the seeded 11**. MIGRATE.1 already requires that verify scripts which enqueue or execute runs **self-clean and
restore the seeded state** — that rule is being violated.

- Find every verify script that creates rows and doesn't fully self-clean (the PO drafts are the known case;
  **sweep for others** — check anything that writes agent proposals, runs, or approvals).
- Make each snapshot the seeded state and restore it, exactly like `verify-wf-1` does.
- **Careful:** `verify-rbac-4`'s cleanup previously used `DELETE … action LIKE 'po.approve.%'`, which nuked the
  CONF.1 calibration history. Any cleanup must be **narrowly scoped to rows that script created** — never a
  broad pattern delete.
- Verify: run `verify:all` twice against a freshly seeded DB and assert the row counts are **identical** before
  and after (Procurement back to 11).

## Verify + gate

1. `backlog.md` reflects `git log` — every shipped story marked, PLM rows present, open rows listed.
2. CLAUDE.md carries the PLM-as-module note, the billing-meter line and the copy guardrail — and the
   `Wedge = Procurement` lines are **unchanged** (assert they're still present verbatim).
3. `verify:all` run twice on a fresh seed leaves identical row counts (no residue); Procurement reads 11.
CI gate: install --frozen-lockfile · lint · turbo typecheck · verify:all · **pnpm build**; commit + push;
Actions green.

## Review gate

Stop after HOUSE.1; show: the backlog diff, the CLAUDE.md diff (proving the wedge lines are untouched), and the
before/after row counts from two consecutive `verify:all` runs.
