# Agentic Infrastructure — Landscape & Build-vs-Buy for Axona

**Prepared:** June 2026 · **For:** Nicolas / Axona · **Lens:** Axona builds its own AgentRuntime,
operational memory, and specialized models as the moat. So the question for every tool is not "is it
good?" but **"does it complement the moat (buy it — table stakes) or duplicate the moat (build it)?"**

> Funding figures are point-in-time and move fast; each is cited. Treat amounts/valuations as "as of the
> cited article," not live.

---

## Executive summary

The agentic-infra market split into clear layers in 2025–26, and money flooded in: LangChain hit a
$1.25B valuation, Browserbase $300M, Braintrust $800M, Modal ~$4.65B. For Axona the useful filter is your
own architecture-learnings doc: **only L2 (memory · models · the learning loop) compounds — everything
else is a competitive necessity you should buy if it's cheaper than building.** That cuts the landscape
into three piles:

- **Build (it IS the moat) — do not outsource:** the agent runtime (you're doing it, ART.1), operational
  memory (MEM.1), the learning loop + reward modeling (LOOP.*), and your specialized SLMs (SLM.1). The
  whole memory-startup category (Mem0/Zep/Letta) and the SLM-tooling category (Fastino/OpenPipe) sit
  right on your moat line — study them as references, don't hand them the crown jewels.
- **Buy now (pure table stakes that complement the moat):** MCP as your connector standard, an
  observability/eval platform (Langfuse or Braintrust), and a model-routing gateway (LiteLLM) for the
  SLM-plus-frontier-fallback layer. These are undifferentiated plumbing — building them is wasted runway.
- **Buy tactically / watch:** browser automation (Browserbase/Steel) only if a tool needs the web; an
  external-SaaS tool-auth layer (Arcade/Composio) for connecting to systems you don't own; AgentMail +
  A2A "agent cards" for agent identity/email once your agents talk to the outside world; Turbopuffer if
  pgvector hits a scale wall.

The sharpest single recommendation: **adopt MCP now** (you're already on Claude/Anthropic; MCP is the
native connector standard and your L1 connector layer should speak it), **adopt an eval/observability
tool now** (you can't run a learning loop you can't measure — this is LOOP.3), and **resist buying a
memory or agent-framework product** because both would fight the architecture that is your defensibility.

---

## Build-vs-Buy matrix

| Category | Verdict for Axona | Why (moat lens) |
|---|---|---|
| Agent frameworks (LangChain/CrewAI/Mastra) | **SKIP / build** | You're building a thin Claude tool-use runtime (ART.1); a heavy framework fights it. Borrow patterns (LangGraph state machines), not the dependency. |
| Agent memory (Mem0/Zep/Letta) | **BUILD (moat) · watch as reference** | Operational memory over genealogy/telemetry/decisions IS the moat (MEM.1). Generic chat memory ≠ that. Maybe use a lib for trivial chat history only. |
| Connector standard (MCP) | **ADOPT NOW** | Anthropic-native, the de-facto tool/connector standard; your L1 connectors (CONN.1) should speak MCP. |
| External tool-auth (Arcade/Composio) | **WATCH / buy for external SaaS** | Your internal tool registry (ART.2) is build. Arcade/Composio earn their keep only for authed access to systems you don't own (Gmail/Slack/Salesforce). |
| Agent email/identity (AgentMail) | **WATCH / adopt later** | Real once agents email suppliers/customers. Resend covers human-approved transactional sends now. |
| Agent discovery/interop (A2A · Agent Cards) | **WATCH** | Matters when Axona agents interoperate with external (supplier) agents. Track the standard; not core yet. |
| Agent payments (x402 / AP2) | **SKIP for now** | Capital-equipment robotics isn't agent-pays-agent micro-commerce; humans approve money (your guardrail). |
| Browser/computer-use (Browserbase/Steel) | **WATCH / tactical buy** | Only if a tool must scrape supplier portals/customs sites. Browserbase if managed, Steel if you need it inside the VPC. |
| Observability + eval (Langfuse/Braintrust/Arize) | **ADOPT NOW** | You cannot run a learning loop you can't trace/score (LOOP.3 eval harness). Langfuse self-hosts (VPC-friendly). |
| Agent simulation/stress-test (Patronus) | **WATCH** | Maps to your Autonomy "sim-validate before promote" surface; interesting, early. |
| Inference/sandbox (Modal/E2B) | **BUY when you train/serve SLMs** | Serverless GPU for SLM training/serving (LOOP.2/SLM.1) and sandboxed tool/code execution. Weigh vs own-VPC GPUs (your wedge). |
| Own-your-model / SLM tooling (Fastino/OpenPipe) | **BUILD the loop · watch/partner to accelerate** | OpenPipe's "fine-tune small models from production traces" IS your LOOP.2. Use to bootstrap, but the loop is the moat. |
| Vector/retrieval (pgvector/Turbopuffer/Pinecone) | **STAY pgvector · watch Turbopuffer** | pgvector is enough now and keeps one store. Turbopuffer if multi-tenant scale/cost bites. Pinecone is fading. |
| AI gateway / model routing (LiteLLM) | **ADOPT (when multi-model)** | Routes SLM-vs-frontier-fallback (SLM.1); open-source, self-hostable in the VPC. |
| Manufacturing AI suites (SAP/Salesforce/Microsoft) | **COMPETITORS, not infra** | Note them in the competitive map; not something you buy. |

---

## Category deep-dives

### 1. Agent frameworks / orchestration — SKIP (build your own runtime)
- **LangChain / LangGraph** — the category leader; **$125M Series B in Oct 2025 led by IVP at a $1.25B
  valuation** (Sequoia, Benchmark, CapitalG, et al.), ~$260M total. LangGraph is its stateful-agent
  runtime. ([TechCrunch](https://techcrunch.com/2025/10/21/open-source-agentic-startup-langchain-hits-1-25b-valuation/), [LangChain](https://www.langchain.com/blog/series-b))
- **CrewAI** — multi-agent orchestration; **$18M Series A (Oct 2024) led by Insight Partners** (boldstart,
  Craft, Andrew Ng, Dharmesh Shah). ([Insight](https://www.insightpartners.com/ideas/crewai-scaleup-ai-story/), [pulse2](https://pulse2.com/crewai-multi-agent-platform-raises-18-million-series-a/))
- **Mastra / LlamaIndex / AutoGen / PydanticAI** — strong OSS frameworks; no fresh raise surfaced.
- **Verdict:** You already chose the right path — a thin Claude tool-use loop (ART.1) on the Anthropic
  SDK. Adopting LangChain/CrewAI would add a heavyweight abstraction over the exact thing that is your
  moat, and complicate per-tenant/VPC deployment. **Borrow ideas (LangGraph's graph/state model is worth
  studying for WF.1), keep the dependency surface thin.**

### 2. Agent memory — BUILD (this is your moat); study these as references
- **Mem0** — vector-first memory layer; **$24M total ($3.9M seed + $20M Series A, Oct 2025), YC + Basis
  Set + Peak XV**; 41k+ GitHub stars, 186M API calls/quarter. ([TechCrunch](https://techcrunch.com/2025/10/28/mem0-raises-24m-from-yc-peak-xv-and-basis-set-to-build-the-memory-layer-for-ai-apps/))
- **Zep** — temporal **knowledge graph** for facts that change over time (Graphiti); **YC W24, ~$3.3M**;
  sub-200ms retrieval, SOC 2. ([startupintros](https://startupintros.com/orgs/zep-ai), [getzep](https://www.getzep.com/))
- **Letta (MemGPT)** — full agent runtime where the model pages its own memory; **$10M seed led by
  Felicis, ~$70M post**. ([agentmarketcap](https://agentmarketcap.ai/blog/2026/04/10/agent-memory-vendor-landscape-2026-letta-zep-mem0-langmem))
- **Verdict:** These are **conversational/agent memory** — useful, but generic. Your moat is **operational
  memory**: a structured graph + vector over decisions, exceptions, approvals, **per-unit genealogy, and
  telemetry**, with credit assignment over long horizons. That is not what Mem0 sells. **Build MEM.1
  yourself** — but Zep/Graphiti's *temporal knowledge graph* is the closest published pattern to what you
  want and is worth reading hard. If you need a quick win for *trivial chat history* in the Agents screen,
  a memory lib is fine; never put the operational graph behind a third party (it's the data substrate that
  compounds and the thing VPC/own-your-model protects).

### 3. Connectors & tool layer — ADOPT MCP; build the internal registry; buy external-SaaS auth only if needed
- **MCP (Model Context Protocol, Anthropic, Nov 2024)** — the connector/tool standard; **Google adopted it
  across its services in Dec 2025** (managed MCP servers for Maps, BigQuery, etc.). ([digitalapplied](https://www.digitalapplied.com/blog/ai-agent-protocol-ecosystem-map-2026-mcp-a2a-acp-ucp))
- **Composio** — tool-integration layer, 200+ app connectors + auth; **~$25–29M Series A (2025) led by
  Lightspeed**. ([SiliconANGLE](https://siliconangle.com/2025/07/22/composio-raises-25m-funding-ease-ai-agent-development/))
- **Arcade.dev** — agent **auth + secure action** layer; **$12M seed (Mar 2025, Laude Ventures) → $60M
  Series A (June 2026), ~$72M total**; authored a core MCP capability. ([Arcade](https://www.arcade.dev/blog/arcade-dev-raises-12m-to-solve-the-biggest-security-challenge-in-ai-agents), [BusinessWire](https://www.businesswire.com/news/home/20260615229631/en/Arcade-Raises-$60M-to-Become-the-Secure-Action-Layer-Behind-Every-Production-AI-Agent))
- **Verdict:** Your typed tool registry over your own data model (ART.2) is **build** — it's core. Where
  Composio/Arcade matter is the **L1 connector layer to systems you don't own** (Gmail, Slack, Salesforce,
  and the ERP/PLM/MES integrations in CONN.1), especially Arcade's per-user OAuth/auth. **Adopt MCP as the
  standard your connectors speak; consider Arcade/Composio for external SaaS auth rather than hand-rolling
  OAuth.** Be aware many of your customers' systems are on-prem MES/PLM these tools won't cover — those
  you build.

### 4. Agent comms / identity / payments — WATCH (real once agents face outward)
- **AgentMail** — email inboxes/identity for agents; **$6M seed, YC S25, led by General Catalyst** (Paul
  Graham, Dharmesh Shah, Supabase + Ramp CTOs); positions email as an **agent identity protocol**,
  supports x402/USDC. ([TechCrunch](https://techcrunch.com/2026/03/10/agentmail-raises-6m-to-build-an-email-service-for-ai-agents/))
- **Resend** — developer transactional email; **$3M seed, YC W23** (Elad Gil, Guillermo Rauch, et al.); no
  later round surfaced. ([TechCrunch](https://techcrunch.com/2023/07/18/developer-focused-email-platform-resend-raises-3m/))
- **A2A (Agent2Agent, Google, Apr 2025)** — agent discovery/delegation; now under the **Linux Foundation**,
  **150+ orgs**, v1.2 with **signed Agent Cards** at `/.well-known/agent-card.json`. ([stellagent](https://stellagent.ai/insights/a2a-protocol-google-agent-to-agent))
- **Agent payments (x402 / AP2)** — Google + Coinbase agentic-commerce/settlement rails. ([eco.com](https://eco.com/support/en/articles/15192002-ap2-protocol-explained-google-s-agentic-commerce-standard-2026))
- **Verdict:** Today, **Resend** (human-approved transactional sends: RFQs, delivery/SLA notices) is the
  pragmatic pick and matches your "human approves" guardrail. **AgentMail** becomes interesting when your
  sourcing/fulfillment agents need their own inbox to two-way negotiate with suppliers — **watch, adopt
  later.** **A2A/Agent Cards**: track as the interop standard for when an Axona agent talks to a supplier's
  agent. **Agent payments: skip** — money in capital-equipment deals is human-gated by design.

### 5. Browser / computer-use — WATCH / tactical
- **Browserbase** — managed headless-browser infra + **Stagehand** (LLM browser-automation SDK); **$40M
  Series B (June 2025) at ~$300M post** (Notable Capital, CRV, Kleiner), 50M sessions in 2025. ([SiliconANGLE](https://siliconangle.com/2025/06/17/browserbase-reels-40m-browser-automation-tools/))
- **Steel.dev** — **open-source** browser API for agents; **~$17M** raised; self-hostable. ([startuphub](https://www.startuphub.ai/startups/steel-dev))
- **Verdict:** Not core to a robotics OS. It earns a slot only when a tool must operate the web — e.g.,
  pulling a supplier's portal price, checking a customs/EAR status page, scraping a datasheet. **Steel** is
  attractive because it self-hosts inside your VPC (matters for your deployment story); **Browserbase** if
  you want managed. **Buy tactically per tool, not as a platform bet.**

### 6. Observability / eval / simulation — ADOPT NOW (you can't run a loop you can't measure)
- **Braintrust** — eval-driven dev + observability as one workflow; **$80M Series B (Feb 2026) at $800M**
  (Iconiq, a16z, Greylock). ([latitude](https://latitude.so/blog/best-llm-observability-tools-agents-latitude-vs-langfuse-langsmith))
- **Langfuse** — **open-source, self-hostable** tracing/eval; **acquired by ClickHouse (Jan 2026)**. ([digitalapplied](https://www.digitalapplied.com/blog/agent-observability-platforms-langsmith-langfuse-arize-2026))
- **Arize** — enterprise ML/LLM observability; **$70M Series C (Feb 2025)**; Phoenix is its OSS. ([getmaxim](https://www.getmaxim.ai/articles/5-ai-observability-platforms-compared-maxim-ai-arize-helicone-braintrust-langfuse/))
- **Patronus AI** — simulated "digital worlds" to **stress-test agents before they touch real systems**;
  **$50M Series B (June 2026), ~$70M total** (Greenfield, Lightspeed, Datadog, Samsung). ([TechCrunch](https://techcrunch.com/2026/06/25/patronus-ai-lands-50m-to-build-digital-worlds-that-stress-test-ai-agents/))
- **Guardrails AI** — OSS output-validation/guardrails; **$7.5M seed** (Zetta, Bloomberg Beta). ([feedtheai](https://www.feedtheai.com/guardrails-ai-secures-7-5m-seed-funding/))
- **Verdict:** **Adopt one now.** Your learning loop needs a trace store + eval harness + reward-hack
  detection (LOOP.3) — buying the tracing/eval substrate is pure leverage. **Langfuse** is the natural pick
  given VPC/on-prem and open-source (now ClickHouse-backed); **Braintrust** if you want the most opinionated
  eval-first workflow. **Patronus** maps cleanly onto your Autonomy module's "sim-validate before promote"
  — watch it. Your `guardrails.config` is build (it's product), but Guardrails-AI patterns are worth a look.

### 7. Model layer — inference, sandboxes, own-your-model SLMs
- **Modal** — serverless GPU/AI cloud; **$87M Series B (Sept 2025) at $1.1B**, then reportedly **~$355M at
  $4.65B (Feb 2026)**. ([Built In](https://www.builtinnyc.com/articles/modal-raises-87m-series-b-1b-valuation-20251001), [TechCrunch](https://techcrunch.com/2026/02/11/ai-inference-startup-modal-labs-in-talks-to-raise-at-2-5b-valuation-sources-say/))
- **E2B** — secure cloud **sandboxes** for agent code/tool execution; **$21M Series A (July 2025, Insight)**;
  88% of Fortune 100 signed up. ([SiliconANGLE](https://siliconangle.com/2025/07/28/e2b-shares-vision-sandboxed-cloud-environments-every-ai-agent-raising-21m-funding/))
- **Fastino** — **task-specific small models (TLMs)**, train on cheap GPUs, inference on low-end hardware;
  **$17.5M seed led by Khosla**, ~$25M total. (Your deck already maps SLMs → Fastino.) ([TechCrunch](https://techcrunch.com/2025/05/07/fastino-trains-ai-models-on-cheap-gaming-gpus-and-just-raised-17-5m-led-by-khosla/))
- **OpenPipe** — **fine-tune small specialized models from production traces**; **$6.7M seed (Costanoa, YC)**.
  This is *literally your LOOP.2 pattern.* ([SiliconANGLE](https://siliconangle.com/2024/03/26/openpipe-raises-6-7m-help-developers-fine-tune-lightweight-powerful-llms/))
- **Predibase** — fine-tuning/serving SLMs; **acquired by Rubrik (June 2025), ~$100–500M**. Signals the
  category is consolidating into bigger platforms. ([TechCrunch](https://techcrunch.com/2025/06/25/rubrik-acquires-predibase-to-accelerate-adoption-of-ai-agents/))
- **Verdict:** **Build the learning loop and own your SLMs — that's the moat (SLM.1/LOOP.2)** and your
  "own-your-model in the customer's VPC" GTM wedge. But you don't need to invent GPU orchestration: **Modal
  or E2B-class infra** is a sound buy for training/serving and sandboxed tool execution (weigh against your
  own VPC GPUs, since on-prem is your wedge). **OpenPipe and Fastino are the closest accelerants to your
  thesis** — strong **watch/partner** candidates to bootstrap SLM fine-tuning from your production traces
  before (or instead of) building all of it; just keep the *loop and the data* in-house.

### 8. Vector / retrieval — STAY on pgvector; watch Turbopuffer
- **pgvector** — handles ~tens-to-hundreds of thousands of vectors/tenant with HNSW at <20ms; one store,
  zero new ops. Past a few hundred thousand/tenant it wants more RAM/partitioning. ([devslane](https://devslane.com/blog/pgvector-vs-purpose-built-vector-db/))
- **Turbopuffer** — object-storage-backed vector+text search; **Thrive-led seed (Dec 2025)**, **~$100M ARR
  by Mar 2026**, clients incl. **Anthropic, Cursor, Notion**; Linear migrated off pgvector for ~70% cost
  cut and zero-ops. ([BetaKit](https://betakit.com/ex-shopify-engineers-raise-fresh-financing-to-scale-turbopuffers-ai-search/), [Sacra](https://sacra.com/c/turbopuffer/))
- **Pinecone** — **~$750M valuation**, revenue softening, reportedly weighing a sale. ([Calcalist](https://www.calcalistech.com/ctechnews/article/rz31q82b5))
- **Verdict:** **Keep pgvector** — it's already in your stack, keeps relational rows + embeddings in one
  Postgres (your whole L1 thesis), and is fine at your current scale. **Watch Turbopuffer** for the day
  multi-tenant vector volume or cost forces a split; it's the strongest momentum story and is multi-tenant
  friendly. **Skip Pinecone.**

### 9. AI gateway / model routing — ADOPT when you go multi-model
- **LiteLLM** — open-source **AI gateway**, one API over 100+ providers + cost tracking/guardrails/routing;
  **YC W23, ~$2.1M**. ([YC](https://www.ycombinator.com/companies/litellm))
- **OpenRouter** — hosted multi-model routing marketplace; no funding figure surfaced.
- **Verdict:** You're Claude-only today, so a gateway is premature. The moment SLM.1 lands (own SLMs +
  frontier fallback), **LiteLLM is a clean, self-hostable router** for "SLM-first, frontier-fallback" — it
  fits the VPC story and saves you writing a routing/cost layer. **Adopt then.**

---

## Adopt-now shortlist (next 1–2 quarters)
1. **MCP** as the connector standard for the L1 connector layer (CONN.1) — Anthropic-native, you're on Claude.
2. **An observability/eval platform — Langfuse** (self-host/VPC, open-source) — you need traces + eval before the learning loop is real (LOOP.3). Braintrust if you prefer eval-first SaaS.
3. **Resend** for human-approved transactional email (RFQs, delivery/SLA notices) — small, fits the guardrail.

## Watch list (track, pilot, or adopt-to-accelerate)
- **OpenPipe / Fastino** — closest to your SLM/learning-loop thesis; pilot to bootstrap SLM fine-tuning from traces.
- **Modal / E2B** — buy when you start training/serving SLMs and need sandboxed tool execution.
- **LiteLLM** — adopt when multi-model (SLM + frontier fallback) lands.
- **Turbopuffer** — adopt if pgvector hits a multi-tenant scale/cost wall.
- **Arcade / Composio** — for authed connectors to external SaaS you don't own.
- **AgentMail + A2A/Agent Cards** — when your agents email/negotiate with external parties and need identity.
- **Patronus** — for the Autonomy "simulate before promote" surface.

## What you might have missed (categories you didn't name)
- **MCP itself** — the single most important standard to adopt; it's the connector/tool layer, not a vendor.
- **Agent identity & auth** — Arcade (agent auth), AgentMail (email-as-identity), A2A signed Agent Cards. An under-built layer that matters once agents act on real systems and money.
- **Agent simulation / pre-production stress-testing** — Patronus's "digital worlds" — directly relevant to validating autonomy/policy changes before they touch a real line/fleet.
- **AI gateways / model routing** — LiteLLM/OpenRouter — the layer that makes "own SLM + frontier fallback" operationally clean.
- **Guardrails/output-validation tooling** — Guardrails AI — you build `guardrails.config`, but the patterns are worth borrowing.

## Competitive note (not infra — incumbents moving on your space)
**SAP, Microsoft (Azure AI Foundry + Fabric, Factory Operations Agent), Salesforce Agentforce for
Manufacturing**, and MES vendors (Parsec/TrakSYS) are embedding agents into manufacturing/supply-chain
workflows. They are **competition for the application layer, not tools you buy** — and they validate the
category. Your defense is exactly the L2 moat: per-unit genealogy + telemetry + the learning loop that a
horizontal incumbent can't replicate. Robotics/physical-AI venture funding hit **$27.6B across 1,009 deals
in 2025** — but that capital is going to robot *foundation models and hardware* (Figure, Skild, Mind
Robotics), not ops-software infra, which is where you sit. ([Crunchbase](https://news.crunchbase.com/venture/biggest-funding-rounds-ai-robotics-ecommerce-quince/), [Microsoft](https://www.microsoft.com/en-us/industry/blog/manufacturing-and-mobility/manufacturing/2025/03/25/industrial-ai-in-action-how-ai-agents-and-digital-threads-will-transform-the-manufacturing-industries/))

---

## Sources
- LangChain — [TechCrunch](https://techcrunch.com/2025/10/21/open-source-agentic-startup-langchain-hits-1-25b-valuation/), [LangChain blog](https://www.langchain.com/blog/series-b)
- CrewAI — [Insight Partners](https://www.insightpartners.com/ideas/crewai-scaleup-ai-story/), [pulse2](https://pulse2.com/crewai-multi-agent-platform-raises-18-million-series-a/)
- Mem0 — [TechCrunch](https://techcrunch.com/2025/10/28/mem0-raises-24m-from-yc-peak-xv-and-basis-set-to-build-the-memory-layer-for-ai-apps/), [YC](https://www.ycombinator.com/companies/mem0)
- Zep — [startupintros](https://startupintros.com/orgs/zep-ai), [getzep](https://www.getzep.com/)
- Letta — [AgentMarketCap](https://agentmarketcap.ai/blog/2026/04/10/agent-memory-vendor-landscape-2026-letta-zep-mem0-langmem)
- AgentMail — [TechCrunch](https://techcrunch.com/2026/03/10/agentmail-raises-6m-to-build-an-email-service-for-ai-agents/), [YC](https://www.ycombinator.com/companies/agentmail)
- Resend — [TechCrunch](https://techcrunch.com/2023/07/18/developer-focused-email-platform-resend-raises-3m/)
- MCP / A2A / Agent Cards / x402 — [digitalapplied](https://www.digitalapplied.com/blog/ai-agent-protocol-ecosystem-map-2026-mcp-a2a-acp-ucp), [stellagent](https://stellagent.ai/insights/a2a-protocol-google-agent-to-agent), [eco.com](https://eco.com/support/en/articles/15192002-ap2-protocol-explained-google-s-agentic-commerce-standard-2026)
- Browserbase — [SiliconANGLE](https://siliconangle.com/2025/06/17/browserbase-reels-40m-browser-automation-tools/), [Sacra](https://sacra.com/c/browserbase/)
- Steel.dev — [startuphub](https://www.startuphub.ai/startups/steel-dev)
- Composio — [SiliconANGLE](https://siliconangle.com/2025/07/22/composio-raises-25m-funding-ease-ai-agent-development/)
- Arcade.dev — [Arcade](https://www.arcade.dev/blog/arcade-dev-raises-12m-to-solve-the-biggest-security-challenge-in-ai-agents), [BusinessWire $60M](https://www.businesswire.com/news/home/20260615229631/en/Arcade-Raises-$60M-to-Become-the-Secure-Action-Layer-Behind-Every-Production-AI-Agent)
- Braintrust / Langfuse / Arize — [latitude](https://latitude.so/blog/best-llm-observability-tools-agents-latitude-vs-langfuse-langsmith), [digitalapplied](https://www.digitalapplied.com/blog/agent-observability-platforms-langsmith-langfuse-arize-2026), [getmaxim](https://www.getmaxim.ai/articles/5-ai-observability-platforms-compared-maxim-ai-arize-helicone-braintrust-langfuse/)
- Patronus AI — [TechCrunch](https://techcrunch.com/2026/06/25/patronus-ai-lands-50m-to-build-digital-worlds-that-stress-test-ai-agents/)
- Guardrails AI — [feedtheai](https://www.feedtheai.com/guardrails-ai-secures-7-5m-seed-funding/)
- Modal — [Built In](https://www.builtinnyc.com/articles/modal-raises-87m-series-b-1b-valuation-20251001), [TechCrunch](https://techcrunch.com/2026/02/11/ai-inference-startup-modal-labs-in-talks-to-raise-at-2-5b-valuation-sources-say/)
- E2B — [SiliconANGLE](https://siliconangle.com/2025/07/28/e2b-shares-vision-sandboxed-cloud-environments-every-ai-agent-raising-21m-funding/)
- Fastino — [TechCrunch](https://techcrunch.com/2025/05/07/fastino-trains-ai-models-on-cheap-gaming-gpus-and-just-raised-17-5m-led-by-khosla/)
- OpenPipe — [SiliconANGLE](https://siliconangle.com/2024/03/26/openpipe-raises-6-7m-help-developers-fine-tune-lightweight-powerful-llms/)
- Predibase / Rubrik — [TechCrunch](https://techcrunch.com/2025/06/25/rubrik-acquires-predibase-to-accelerate-adoption-of-ai-agents/)
- Turbopuffer — [BetaKit](https://betakit.com/ex-shopify-engineers-raise-fresh-financing-to-scale-turbopuffers-ai-search/), [Sacra](https://sacra.com/c/turbopuffer/)
- Pinecone — [Calcalist](https://www.calcalistech.com/ctechnews/article/rz31q82b5), [Menlo](https://menlovc.com/perspective/pinecone-now-valued-at-750m/)
- LiteLLM — [YC](https://www.ycombinator.com/companies/litellm)
- Robotics/manufacturing context — [Crunchbase](https://news.crunchbase.com/venture/biggest-funding-rounds-ai-robotics-ecommerce-quince/), [Microsoft](https://www.microsoft.com/en-us/industry/blog/manufacturing-and-mobility/manufacturing/2025/03/25/industrial-ai-in-action-how-ai-agents-and-digital-threads-will-transform-the-manufacturing-industries/)
