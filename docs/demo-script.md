# Demo script — the Axona click-through

The scripted walkthrough for investor and design-partner demos. ~10 minutes of clicking, built on the
seeded cross-module narrative. Every screen is real product; every number is sample data.

**The one thing they should leave with:** humans + machines + agents on one system — where the agents
*propose*, humans *approve*, and every decision is *audited*. Not a dashboard. An operating system.

**Sample-data discipline (non-negotiable):** the seed narrative is fictional. Say "sample data" out loud
the first time a customer name appears, and never imply a real customer, person, or traction number. In any
recording or screenshot that leaves the room, the OEM is a "Tier-1 auto OEM," never a real marque.

---

## Act 0 — Setup (before they're in the room)

Run `./dev.sh --seed` and sign in as **admin@axona-demo.test** (Dana Reyes · Admin). The `--seed` matters:
verify runs leave a few $0 agent-draft PO rows behind, and you want Procurement reading exactly as designed.
Park the browser on `/core`, full screen, no devtools, zoom so the mono labels are legible from across a table.

Have `/agents` open in a second tab — Act 4 is smoother if you don't have to navigate to it cold.

---

## Act 1 — One system (`/core`) · ~90s

Open on Command Center. Don't narrate the tiles; let them scan it while you say the thesis:

> "This is a robotics company's whole operating picture on one screen — design through procurement, build,
> test, delivery, deployment, and service. Twenty-four modules, one system. Everything you're looking at is
> sample data, but it's the real product."

Then point at the **exception feed** — that's the actual hook. Not "we have modules," but *"the problems a
robotics company actually has are cross-module by nature, and nobody's tool is."*

> "Eight open exceptions. Look at what they are: a quality flag that's really a procurement problem. A
> delivery held at customs that's really a legal problem. A robot running hot in the field that's really a
> service-scheduling problem. Every one of these crosses three or four systems today — which is why they get
> resolved in Slack threads and spreadsheets."

Leave **NCR-118 — Drive torque over UCL (stiff actuator)** on screen. That's the thread you'll pull all demo.

---

## Act 2 — The wedge: agentic procurement (`/procurement`) · ~2.5 min

This is the sharpest part of the product. Slow down here.

Show the **PO queue**: agent-drafted rows sitting alongside sent ones. Open the co-working agent pane and let
the **trace** run — scan, correlate, tool call, result.

> "The sourcing agent drafted this PO. It read the BOM, the stock position, the lead times, and the supplier
> history — and it's proposing an order. It did *not* place it."

Then the two moves that make the point:

**Open the trace.** Show `inputs · output · model · confidence`. Land on confidence explicitly:

> "0.83. That's a real calibrated number, not decoration — it's what gates how much autonomy this agent is
> allowed. Low confidence means it comes to a human. High confidence, earned over time, means it can move."

**Approve it.** Click the lime action. That's the whole product philosophy in one click:

> "Propose, approve, audit. The agent does the work; the human owns the decision. Money, safety, and contract
> actions are gated — always. The guardrails are enforced data, not a marketing line: never auto-place an
> order, never claim stock without a source, never invent a supplier or a lead time."

If they push on why procurement first: long-lead sourcing plus BOM churn is where robotics companies bleed,
and it's the one place an agent has enough structured context to be genuinely useful on day one.

---

## Act 3 — Per-unit genealogy (`/manufacturing`) · ~2 min

The moat starts here, and it's the least-understood slide in most decks — so *show* it instead.

Open a unit's **build genealogy**: the as-built record — every part, every serial, every firmware version,
captured at the station as it's built.

> "This isn't a report we reconstructed. It's captured as-built, at the station. Which part, which serial,
> which firmware, which operator, which torque reading — per unit."

Then point at the **HOLD at Test → NCR-118**:

> "And when this unit failed test, the system already knew exactly which actuator lot went into it."

Say the quiet part:

> "Every robotics company will eventually have agents. The question is who has the data to make theirs good.
> Per-unit genealogy plus every agent trace is a proprietary substrate that nobody can buy — and it compounds
> with every unit built."

---

## Act 4 — The ripple (`/agents`, then follow it) · ~2.5 min

The money moment. Everything so far was modules; this is why it has to be an **OS, not point tools**.

Go to the **Axona agent** (the cross-module one) and ask it, out loud, in front of them:

> **"What's the blast radius of NCR-118?"**

Let the trace run visibly. It reads across Quality, Engineering, Procurement, Fulfillment, Field Service, and
Finance — and answers from real records.

> "No integration project. No data team. It reads across every module because it's one system."

Then walk the cascade so they see it's real, not an LLM being fluent — click through the thread:

**Quality** (`/quality`) — the SPC control chart, two points over the upper control limit. That's the origin.
**Engineering** (`/engineering`) — the ECO opened against the actuator.
**Procurement** (`/procurement`) — the resourcing decision on the affected lot.
**Fulfillment** (`/fulfillment`) — the deliveries carrying units from that lot.
**Field Service** (`/field-service`) — the units already deployed, and the dispatch.

> "One control-chart breach. Six modules affected. Today that's a week of meetings and someone's spreadsheet.
> Here it's one question."

---

## Act 5 — Trust (`/audit`) · ~1.5 min

The objection you're pre-empting is *"I'm not letting an AI touch my supply chain."* Answer it with the log.

> "Ninety agent actions. Eight human decisions. Every one of them immutable."

Open an entry: **inputs · output · model · confidence · approver**.

> "Every action an agent takes writes what it saw, what it produced, which model, how confident it was, and
> who approved it — to an append-only log. You can't delete it. You can't edit it. That's what makes this
> deployable in a regulated shop, and it's what makes autonomy something an agent *earns* rather than
> something you gamble on."

---

## Act 6 — The close · ~1 min

Back to `/core`. Don't click anything. This is the only part that's argument, not demo.

> "Everything you just saw generates data: decisions, exceptions, approvals, genealogy, telemetry. That feeds
> the memory. The memory trains models specialized to *this* company's parts, suppliers, and failure modes.
> Better models make better proposals. Better proposals get approved more often. And that produces more data."

> "The modules are table stakes — someone will build those. The loop is the moat, and it only compounds if
> you own the whole spine. That's the bet."

---

## If they ask

**"Isn't this just an ERP?"** — No. An ERP records what happened. This proposes what to do next, and the
record is a byproduct. It's an operating system: the modules are surfaces on a shared spine of memory,
models, and agents.

**"What happens when the agent is wrong?"** — It gets caught at approval, and the miss is logged with its
confidence. That's the training signal. A wrong proposal at 0.6 confidence is the system working; a wrong
action at 0.95 that nobody caught is the thing the architecture makes impossible for gated actions.

**"Why would a robotics company rip out their stack for you?"** — They don't start there. They start with
procurement, because that's where the pain is measurable in weeks of slipped schedule. The rest follows the
data.

**"Can we run this in our own VPC / with our own models?"** — Per-tenant isolation of data *and* models is
part of the architecture, not a bolt-on. One customer's data and models never touch another's.

**"How is this defensible against a foundation-model company?"** — They have the models; they don't have the
per-unit genealogy or the approval traces from inside a robotics plant. That data isn't on the internet.

---

## Do not

Do not quote traction, customer counts, or revenue — there aren't any, and inventing them is the one
unrecoverable mistake in a room like this. Do not name a real OEM. Do not click into anything you haven't
rehearsed; a 404 or an empty state costs more credibility than a whole extra module buys. If something
breaks, say "that's sample data, let me show you the real thing" and move — never debug live.
