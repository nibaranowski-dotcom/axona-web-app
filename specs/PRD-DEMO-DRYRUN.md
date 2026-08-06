# PRD — DEMO.7: live-demo readiness verification (the three run-of-shows will actually work)

*The emails are sent; meetings are likely. This verifies the three LIVE demo scripts (the `.docx` run-of-shows)
end-to-end — not just that links resolve (DEMO / `verify:demo` already covers that), but that **what the presenter
SAYS matches what the screen SHOWS, that every beat narrated as "the agent acting" actually shows it, that the
LIVE agent answers safely when a prospect goes off-script, and that off-path poking never hits an empty/leaky
screen.** Prospects/people are anonymized (defense-eng prospect · config-advisor prospect · warehouse prospect);
tenants DroneCo + the warehouse tenant; codes SN-DC-4471 / NCR-DC-118 / ECO-DC-318 / CFG-DC-r4.2 / NM-GRIP-SERVO /
PO-NM-9007 / WO-NM-5521 / NM-PICK-0142. Guardrail: never name a banned marque in this file (it's in `specs/`).*

## Why link-verification isn't enough
`verify:demo` proves each deep link resolves + is populated + the email's claims hold. It does NOT prove:
(a) the SCRIPT's spoken numbers match the seed, (b) the beats narrated as agentic actually render the agent, (c)
the live agent answers correctly + safely off-script, (d) off-path screens are clean. Those are where a live room
breaks.

## The four things to verify

### 1. Script fidelity — every spoken number/entity matches the seed
The presenter reads specific figures aloud ("0 on hand vs a min of 8", "6 of 6", "85% ready, blocked on two",
"7 days past promised"). Each must equal the seed, or the presenter contradicts the screen live.
- **Known mismatch to fix:** the warehouse script says NM-GRIP-SERVO is "**min of 8**"; the seed has **min 6**.
  Align them (set the seed to 8 to match the narration, or fix the script) — and add the assertion so it can't
  drift again.
- Build a **script-fidelity check** (`verify:demo-script <scenario>`): a per-scenario manifest of the SPOKEN
  claims (entity + the exact number narrated) asserted against the seed — like `verify:demo` but sourced from the
  `.docx` narration, not the email. Gitignored manifest (names the tenant + codes). Green = the presenter's script
  is data-true.

### 2. Agentic-surface completeness — every narrated "the agent …" beat shows it
Each script frames all five beats as "an agent proposing, a human approving, audited." Today only two per scenario
are agentic (RCA #4 · fault-loop #10 — DEMO.6). The rest render data with no agent marker, so the narration lies.
**Prerequisite: finish the DEMO.6 beats the scripts narrate as agentic** — config-first #6 (the config advisor
judges it first), drift #2, blast+change #5, inventory #7, procurement+chase #8, build-readiness #11. Until a
beat shows the propose · confidence · approve · audit surface, its script line ("the agent flags…", "the agent
drafted…", "the system is chasing…") is a claim the screen contradicts. This PRD's DoD includes: no script line
asserts agent behavior a screen doesn't render.

### 3. Live agent-response safety — the highest risk, currently unverified
Every script invites off-script interaction ("throw your real workflows at it"). So the **live Axona agent will be
asked questions in the room** — over real model calls + tools + the seed. It must: (a) answer CORRECTLY and
grounded in the seed, (b) stay on-narrative (config/traceability/procurement — not "operating system / 24 modules
/ ERP" jargon), and (c) **NEVER leak** — no banned product designation (SEED.1/SEED.4 list), no real
marque/person, no fabricated number, no
cross-tenant data. A single leaked designation or invented figure in that room is unrecoverable.
- Build a **live agent-response harness** (`verify:demo-agent <scenario>`): a battery of likely prompts — the
  scripts' implied questions ("what's the blast radius of that lot?", "which units carry it?", "why did this
  fail?", "what's blocking this build?") + adversarial probes (asking for a real customer, a competitor, the
  product's real name) — run against the LIVE agent on the demo tenant. Assert each answer: grounded (cites real
  seeded entities), on-narrative, and passes the anonymization scan (0 HX/marque/jargon) and the no-fabrication
  check (every figure it states is recomputable from the seed, like the RCA confidence). Run it against BOTH demo
  tenants. This is the "one unrecoverable mistake" guard, automated.

### 4. Off-path robustness — poking never hits empty/dead/leaky
Prospects self-serve beyond the scripted links. Off-path screens must be populated (PROSPECT.3), leak-free (the
DMMF HX sweep, SEED.4), and every LINK.1 hop must land focused (LINK.2 — the remaining soft-dead-end screens
`/quality /fulfillment /finance /engineering`). Assert: a crawl of the tenant's reachable screens finds no empty
state, no bare-list soft-dead-end on a linked hop, and 0 marque hits.

## The dry-run (the actual "can it be shown" test)
Walk each `.docx` end-to-end in a real browser (Chrome): open the login, click every link in order, do the RCA
Confirm (see the writeback), click the fault loop both directions, and at each step confirm the SCREEN matches the
SPOKEN line. Screenshot every step. This is the human/agent rehearsal the DoD hinges on — a green harness plus an
eyeballed dry-run.

## DoD
- `verify:demo-script` green on all three scenarios (every spoken number matches the seed; the min-8/6 mismatch
  fixed).
- Every beat a script narrates as agentic renders the agent surface (DEMO.6 beats #2/#5/#6/#7/#11 done) — no
  narration contradicts a screen.
- `verify:demo-agent` green on both tenants: answers grounded + on-narrative + 0 leak + 0 fabricated figures,
  including the adversarial probes.
- Off-path crawl: 0 empty states on reachable screens, 0 soft-dead-ends on linked hops, 0 marque hits.
- A full scripted dry-run per `.docx` passes with screenshots at each step (screen matches narration).
- `verify:all` + `verify:demo droneco`/warehouse + `verify:seed-1` + eval green.

## Guardrails
Real data + real calibrated confidence, never fabricated · the live agent is the top risk — verify it explicitly,
including adversarial leak probes · anonymization clean on both tenants and in the agent's own answers · gitignored
manifests (they name tenants/codes) · this file names no banned marque · additive · no `db push`.

## Sequencing
The dry-run can't pass until the DEMO.6 beats the scripts narrate are done, so: finish DEMO.6 (#6 config-first
first — the config advisor judges it first — then #2/#5/#7/#11), build `verify:demo-script` + fix the min mismatch,
build `verify:demo-agent`, close LINK.2, then the eyeballed dry-run per script. The two hero beats already carry
the rooms if a meeting lands before the rest is done.
