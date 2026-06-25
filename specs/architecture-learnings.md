# Axona — Architecture learnings

**For:** Head of Product
**From:** working session structuring the technical-architecture deck (Julia White recruiting conversation)
**Status:** thesis and design intent, not claimed traction. Everything below is how the product is *meant* to be built; the platform screens referenced are the founder's prototype.

This is a synthesis of what became clear while turning the moat story into a legible architecture: where the defensibility actually lives, what is hard vs. routine, and what we have to get right in sequence. Read it as "what a PM should hold in their head about the system."

---

## 1. The one-line architecture thesis

A robotics company's workforce is **humans + machines + agents**, and the company that builds the operating system for all three — on **proprietary robotics operational data** — compounds an advantage a horizontal incumbent cannot copy.

The defensible asset is **not the UI**. It's the data exhaust of how a specific robotics company builds, turned into **specialized models + operational memory** that get sharper with every unit shipped. That loop is an AI/ML problem end to end — which is why this is an AI company, not an ERP.

**Product implication:** every roadmap decision should be scored on whether it feeds the loop (data → memory → models → better proposals → outcomes → data). Features that don't touch the loop are table stakes, not moat.

---

## 2. The system is four layers over one spine

| Layer | What it is | Role |
|---|---|---|
| **L4 — Vertical editions** | Humanoid · Mobility · Healthcare | Packaging / GTM surface |
| **L3 — Domain apps** | Procurement · Quality · Maintenance · Delivery | Where users do work |
| **L2 — Intelligence spine** | Specialized models · operational memory · agent runtime | **THE MOAT** |
| **L1 — Foundation** | Connectors · ontology · data plane | Gets data in, normalized |

**Learning:** L1, L3, L4 are *competitive necessities* — they have to be good, but they are buildable by anyone with engineers. **L2 is the only layer that compounds.** Resourcing should reflect that asymmetry: the spine is where the hardest people and the most research time go. The rest is execution.

---

## 3. The foundation decides whether the moat is even possible

Connectors pull from **ERP/PLM/MES, email, chat, and machine telemetry**; a normalize step resolves entities, dedupes, and diffs against last state; output lands in **ontology + per-unit genealogy + an immutable event log**, stored in **Postgres + pgvector** (relational rows and embeddings in one store).

**Two things make this robotics-native rather than a generic ERP connector:**
- **Machine telemetry** as a first-class input, not an afterthought.
- **Per-unit genealogy** (parts · serials · firmware, captured *as built*, not reconstructed later).

**Product learning:** genealogy and telemetry are not "nice reporting features" — they are the **label source and structured-memory substrate** the whole moat is built on. If we let them be captured loosely or after-the-fact, the intelligence layer has nothing clean to learn from. Capture quality at L1 caps model quality at L2. This is the least glamorous and most leverage-heavy investment in the product.

---

## 4. The ontology is "a labeled trajectory per robot"

The domain model spans Unit · Part · Serial · Firmware · BOM · PO/RFQ · Supplier · Work order · Machine/fixture · Human · Agent. The **genealogy spine** (Unit → Parts/Serials/Firmware) is the load-bearing relationship.

The framing that unlocked the rest: **every robot is a labeled trajectory of decisions and outcomes.** That sentence is the bridge between "we store data" and "we can train models" — because a trajectory with a verifiable end state is exactly what RL and credit assignment need.

**Product learning:** the ontology must model **machines, fixtures, serials, firmware and telemetry** — not just tickets and documents. That is the difference between us and an ontology/decision-logic product built for software-only ops.

---

## 5. The moat is mechanical, and it compounds for three specific reasons

The flywheel: **proprietary ops data → operational memory → specialized models → agents propose actions → outcomes → (back to data/memory)**, closed by a continuous-learning loop.

It compounds because of three properties that are rare *together*:

1. **The reward signal is unusually clean.** In most enterprise AI the reward is fuzzy ("was the answer good?"). In robotics ops it's physical and verifiable: *did the part arrive on time, did the line halt, did the unit pass test.* Dense, ground-truth reward is what makes online learning tractable.
2. **Genealogy is a natural structured-memory substrate and label source.** No separate labeling pipeline — the operation labels itself as it runs.
3. **Customers are concentrated, homogeneous, high data-gravity.** Models and memory built with partner 1 transfer to partner 2 as **config, not rebuild.**

**Product learning:** these three are the actual moat criteria. When evaluating a new vertical, domain, or customer, ask: *does it preserve the clean physical reward? does it produce labeled trajectories? is it homogeneous enough to transfer?* A segment that fails these is revenue, not moat.

---

## 6. The agent runtime is `propose → approve → audit`, and "confidence" is load-bearing

The core loop: **assemble context (memory + ontology) → propose action → guardrails/policy check → human approval [progressive trust] → execute via tool/integration → log (inputs · output · model · confidence · approver) → learn.**

**Learnings:**
- **Human-in-the-loop is the product, not a limitation.** "AI proposes, human approves" should be enforced as data (see §8), not a marketing line. It is what makes agents acting on real spend and inventory acceptable to a buyer.
- **`confidence` is a real, calibrated field — not decoration.** It is the thing a human actually uses to decide whether to trust a proposal. Calibrated confidence is a research problem (pragmatics / calibrated listeners), and it directly gates how fast we can grant autonomy.
- **Autonomy is earned progressively.** Agents widen scope as trust accrues. The trust ladder is itself a product surface and should be designed, measured, and surfaced — not implicit.

---

## 7. The intelligence spine is four research lines, not one feature

The spine decomposes into work that is **squarely a research org's job**, none of it solved off-the-shelf:

- **A. Operational memory that compounds** — structured graph + vector over decisions/exceptions/approvals/genealogy/telemetry. *Not* RAG-over-PDFs. Open problems: representation/retrieval for operational decisions, and credit assignment over long horizons.
- **B. The continuous-learning loop** — train → serve → improve, with a *physical* reward. Online RL + self-distillation from production traces; reward modeling from outcomes; **reward-hack detection + an eval harness so the loop doesn't game itself.**
- **C. Human↔machine↔agent pragmatics** — right action, right human, right context, calibrated confidence; amortized so it runs on every proposal, not just in the lab.
- **D. Specialized small models you can own** — task-optimized SLMs (BOM diffing, supply-risk, genealogy QA) that beat a generic frontier model on the specific tasks and deploy inside a customer VPC; frontier kept as fallback for the long tail.

Plus two adjacent lines: **E. ontology/decision-logic extraction** (robotics-native, white-box playbooks) and **F. multi-agent orchestration** over a physical operation under real constraints.

**Product learning:** the spine is a *portfolio*, not a checkbox. PM should treat A–D as parallel bets with their own eval metrics, and resist the temptation to ship a single "agent feature" and call the moat done.

---

## 8. Governance and deployment are product features, not compliance overhead

Four controls, all of which a buyer evaluates:

- **`guardrails.config`** — hard rules as enforced data: *never auto-place an order · never claim stock without a source · never invent a supplier or lead time.* This is "AI proposes, human approves" made literal.
- **RBAC + immutable audit** — every agent action attributable (who · what · model · confidence · approver).
- **Per-tenant isolation** — one customer's data/models never leak into another's. (This is also what protects the "config, not rebuild" transfer story from becoming a data-leak liability.)
- **VPC / on-prem + own-your-model SLMs** — required in regulated and on-prem environments, and a **GTM wedge**, not just a control. "Own your model" sells.

**Product learning:** trust and deployment posture are *sales unlocks*, not cost centers. The own-your-model + VPC story is a reason to choose us, especially in regulated verticals.

---

## 9. The platform thesis: "custom on the surface, platform underneath"

Verticals (rows) × Domains (columns). The **first custom solve in one cell decomposes into reusable primitives** — *agents · memory objects · ontology objects · integrations · interfaces · SOPs* — that **recompose** into adjacent cells as **config, not rebuild.**

**Learning — this is the single most important operating discipline for the product org.** Services-shaped companies die because each deployment is a one-off. The only thing that converts a custom solve into product is the rule: *every bespoke build must be decomposed into named, reusable primitives.* If a deployment ships without producing reusable primitives, it was services, and it dead-ended. PM should hold a literal inventory of primitives and track recomposition rate (how much of deal N was config vs. net-new build).

---

## 10. Where we sit vs. the reference cohort

The common stack across the AI-native-OS cohort is real; we re-cut it to be robotics-native.

- **Applied Compute** — proves the train→serve→improve loop + own-your-model. *We take* the loop and the specialized-models/memory rail. *Our difference:* reward comes from the physical line, not a human thumbs-up.
- **Edra** — proves living playbooks (ontology from data exhaust, white-box). *We take* the ontology + governance surface. *Our difference:* ontology spans machines, telemetry, genealogy.
- **Sycamore** — proves a Trusted Agent OS (progressive trust, audit/RBAC). *We take* the trust/governance rail. *Our difference:* trust must cover agents acting on physical inventory and spend.
- **Ciridae** — proves the land-the-wedge / design-partner motion. *We take* the wedge motion. *Our difference:* we go deep on one vertical (robotics), not broad mid-market.

**Net:** the product is mostly the cohort's common stack made robotics-native. The part that keeps it **product, not services**, is the intelligence layer — model + memory + the learning loop.

---

## 11. Build sequence (the order is the strategy)

1. **Foundation + ontology** — get clean, robotics-native capture first. Everything downstream is capped by this.
2. **Memory + retrieval** — the substrate the agents reason over.
3. **Agent runtime + guardrails** — `propose → approve → audit` with enforced rules.
4. **First domain — procurement co-pilot** — the wedge; warmest access, most painful job (long-lead sourcing + BOM churn + genealogy).
5. **Close the learning loop** — wire outcomes back into training; this is when the moat starts compounding.

Reference architecture as scoped: `Next.js web · worker/queue · Postgres+pgvector (Prisma) · agent runtime (packages/agents) · model layer (SLMs + frontier fallback) · connector layer`, deployed **per-tenant (VPC).**

**Product learning:** steps 1–4 are credible-product; **step 5 is where defensibility begins.** A plan that stops at "we shipped a procurement co-pilot" has built a feature, not the moat. Protect the runway to close the loop.

---

## 12. Open questions / risks a PM should track

- **Capture fidelity risk.** If genealogy/telemetry capture is loose or retrofitted, the moat never forms. This is the top risk and it lives at L1.
- **Reward-hacking.** A clean reward is also a gameable one. The eval harness + reward-hack detection are not optional; budget for them in the loop, not after.
- **Transfer reality.** "Config, not rebuild" is a thesis until proven across the *second* customer in a vertical. Measure recomposition rate from deal 2 onward.
- **Wedge discipline.** Let the first 2–3 design partners confirm which painful domain to anchor on (procurement is the leading hypothesis, not a settled fact). Resist horizontalizing before the loop closes.
- **Autonomy pacing.** Granting scope faster than confidence calibration justifies is how trust (and a buyer) is lost. The progressive-trust ladder needs explicit metrics.

---

*Sources for the cohort facts: Applied Compute, Edra, Sycamore, Ciridae public funding per SiliconANGLE, Sequoia, BusinessWire, Fortune, Tech.eu. Axona's moat is presented as thesis, not claimed traction; competitor names are factual references, not partnerships or endorsements.*
