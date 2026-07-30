/**
 * EVAL.1 — the eval cases. Each is a `{ situation, expected }` assertion run against
 * the REAL agent runtime + REAL tools. Offline cases script the `FakeModelClient` so
 * they're deterministic + key-free (the CI gate); live cases exercise the real model
 * (opt-in, EVAL_LIVE=1). We assert the TOOL LOOP + real tool output, not model prose.
 */
import {
  buildAgentDef,
  runLoop,
  TraceCollector,
  FakeModelClient,
  AnthropicModelClient,
  axonaSystemPrompt,
  getBlastRadius,
  extractColumn,
  LOW_CONF_FALLBACK,
  type ModelClient,
  type ModelResponse,
  type BlastRadiusResult,
  type AgentContext,
} from "@axona/agents";
import { getCalibrationModel, calibratedConfidence } from "@axona/db";
import type { EvalCase, EvalCtx } from "./harness";

// ── helpers ───────────────────────────────────────────────────────────────────

const AXONA_DESC =
  "Cross-module copilot: read across modules, cite records, recall precedent.";

// VERIFY.2 — a pinned recency reference so recall ranking is deterministic across
// seed order / wall-clock (the eval runs mid-verify:all over an ACCUMULATED memory
// substrate). Far-future ⇒ the 90-day-half-life recency term is uniformly
// negligible, so ranking is driven by the seed-order-independent graph ⊕ kind ⊕
// vector signals. Only used where a case controls the recall call directly.
const EVAL_NOW = Date.UTC(2100, 0, 1);

/** The REAL Axona core agent def (real prompt + real cross-module read tools). */
function axonaDef() {
  return buildAgentDef({
    moduleKey: "core",
    role: "AXONA",
    description: AXONA_DESC,
  });
}

/** A scripted fake-model turn. */
const say = (text: string): ModelResponse => ({
  stopReason: "end_turn",
  text,
  toolUses: [],
  model: "fake",
  usage: { inputTokens: 4, outputTokens: 4 },
});
const callTool = (name: string, input: unknown, id = "tc1"): ModelResponse => ({
  stopReason: "tool_use",
  text: "",
  toolUses: [{ id, name, input }],
  model: "fake",
  usage: { inputTokens: 4, outputTokens: 4 },
});

function ctxFor(
  db: EvalCtx["demo"],
  orgId: string,
  trace: TraceCollector,
): AgentContext {
  return { orgId, userId: "eval", agentId: "eval", db, trace };
}

// ── OFFLINE cases ───────────────────────────────────────────────────────────────

const offline: EvalCase[] = [
  {
    id: "OFF-1",
    title: "blast-radius question → agent calls getBlastRadius (real cascade)",
    tier: "offline",
    category: "tool-selection",
    run: async ({ demo }) => {
      const model = new FakeModelClient([
        callTool("getBlastRadius", {
          entityType: "NCR",
          code: "NCR-118",
          maxDepth: 4,
        }),
        say("NCR-118 touches 19 records across 8 modules (cited)."),
      ]);
      const trace = new TraceCollector();
      const res = await runLoop(
        axonaDef(),
        "What is the blast radius of NCR-118?",
        ctxFor(demo, "org_axona_demo", trace),
        model,
      );
      const called = trace.lines.find(
        (l) => l.kind === "tool" && /getBlastRadius/.test(l.text),
      );
      const result = trace.lines.find(
        (l) => l.kind === "tool-result" && /getBlastRadius/.test(l.text),
      );
      const out = result?.data as BlastRadiusResult | undefined;
      const n = out?.nodeCount ?? 0;
      return {
        pass: !!called && res.status === "SUCCEEDED" && n >= 10,
        detail: called
          ? `getBlastRadius fired → ${n} linked records across ${out?.groups.length ?? 0} modules`
          : "getBlastRadius was NOT called",
      };
    },
  },
  {
    id: "OFF-2",
    title: "'have we seen this?' → precedent recalled (MEM.2 auto-injection)",
    tier: "offline",
    category: "tool-selection",
    run: async ({ demo }) => {
      // The model does nothing; MEM.2 auto-injects memory into the system prompt
      // before the first call — recall is RECEIVED without an explicit tool call.
      let capturedSystem = "";
      const model: ModelClient = {
        async createMessage(args) {
          capturedSystem = args.system ?? "";
          return say("This resembles the prior contained incident (cited).");
        },
      };
      const trace = new TraceCollector();
      await runLoop(
        axonaDef(),
        "Have we seen a defect like NCR-118 before, and how was it handled?",
        ctxFor(demo, "org_axona_demo", trace),
        model,
      );
      const mem = trace.lines.find((l) => l.kind === "memory");
      // VERIFY.2 — assert the NCR-114 precedent AUTO-INJECTED into the model's
      // system prompt (membership within the default token budget every precedent
      // fits), not the recency-sensitive #1 trace slot. Robust to the accumulated
      // substrate, still a real MEM.2 auto-injection assertion.
      const injected =
        !!mem &&
        /injected \d+ prior episode/.test(mem.text) &&
        /NCR-114/.test(capturedSystem);
      return {
        pass: injected,
        detail: mem
          ? `memory trace: "${mem.text}"`
          : "no memory injected (recall did not fire)",
      };
    },
  },
  {
    id: "OFF-3",
    title: "malformed structured output → low-confidence fallback, no crash",
    tier: "offline",
    category: "structured-output",
    run: async () => {
      // A model that returns un-parseable output where a ColumnAnswer is expected.
      const garbage: ModelClient = {
        async createMessage() {
          return {
            stopReason: "end_turn",
            text: "not json at all {{{ <<< ",
            toolUses: [],
            model: "fake",
          };
        },
      };
      const answer = await extractColumn(
        "SERVO-204 · lot 88421 · torque 2.1 N·m",
        "What is the lot number?",
        { model: garbage },
      );
      const fellBack =
        answer.confidence === LOW_CONF_FALLBACK.confidence &&
        answer.value === LOW_CONF_FALLBACK.value;
      return {
        pass: fellBack,
        detail: fellBack
          ? "malformed model output → LOW_CONF_FALLBACK (conf 0), loop did not throw"
          : `expected fallback, got ${JSON.stringify(answer)}`,
      };
    },
  },
  {
    id: "OFF-4",
    title: "malformed tool INPUT → runtime rejects gracefully, loop continues",
    tier: "offline",
    category: "structured-output",
    run: async ({ demo }) => {
      // Model asks for a tool with input that fails the tool's Zod schema; the
      // runtime must trace an error, feed it back, and let the loop finish — no throw.
      const model = new FakeModelClient([
        callTool("getBlastRadius", { entityType: "NOT_A_TYPE" }),
        say("Could not trace that entity."),
      ]);
      const trace = new TraceCollector();
      const res = await runLoop(
        axonaDef(),
        "Blast radius of a bogus entity?",
        ctxFor(demo, "org_axona_demo", trace),
        model,
      );
      const err = trace.lines.find(
        (l) => l.kind === "error" && /invalid input/.test(l.text),
      );
      return {
        pass: !!err && res.status === "SUCCEEDED",
        detail: err
          ? `runtime traced "${err.text}" and completed (status ${res.status})`
          : "malformed input was not rejected as expected",
      };
    },
  },
  {
    id: "OFF-5",
    title: "grounding — cold-start org invents no memory and no links",
    tier: "offline",
    category: "grounding",
    run: async ({ cold, coldOrgId }) => {
      // (a) recall on a cold org → honest cold-start (no fabricated precedent).
      const trace = new TraceCollector();
      const model: ModelClient = {
        async createMessage() {
          return say("No prior record found.");
        },
      };
      await runLoop(
        axonaDef(),
        "Have we seen NCR-118 before?",
        ctxFor(cold, coldOrgId, trace),
        model,
      );
      const mem = trace.lines.find((l) => l.kind === "memory");
      const honestMemory =
        !!mem && /no prior episodes injected \(cold-start\)/.test(mem.text);
      // (b) blast radius on the cold org → zero nodes (no invented links).
      const br = await getBlastRadius(cold, {
        entityType: "NCR",
        code: "NCR-118",
        maxDepth: 4,
      });
      const noFabrication = br.nodeCount === 0;
      return {
        pass: honestMemory && noFabrication,
        detail: `cold memory: ${
          honestMemory ? "honest cold-start" : "FABRICATED"
        } · cold blast radius: ${br.nodeCount} nodes`,
      };
    },
  },
  {
    id: "OFF-6",
    title: "moat — recall surfaces the NCR-114 precedent VIA THE GRAPH",
    tier: "offline",
    category: "moat",
    run: async ({ demo }) => {
      // The precedent (NCR-114) is reached through the entity graph (shared SERVO-204
      // / ECO-318), not just text similarity — assert the graph arm fired.
      const { assembleContext } = await import("@axona/db");
      const asm = await assembleContext(demo, {
        subject: { type: "NCR", id: "NCR-118" },
        query: "Have we seen this servo defect before?",
        limit: 15,
        floor: 0,
        now: EVAL_NOW, // VERIFY.2 — deterministic recency
      });
      // VERIFY.2 — the moat claim is that NCR-114 is reached THROUGH THE GRAPH
      // (shared SERVO-204 / ECO-318), not just text. Assert it is among the injected
      // precedents AND came via the graph arm — MEMBERSHIP + graph, invariant to the
      // accumulated substrate (an unrelated OUTCOME can legitimately outscore it).
      const n114 = asm.hits.find((h) => h.subjectCode === "NCR-114");
      const viaGraph = !!n114 && !!n114.via.graph;
      return {
        pass: asm.reason === "injected" && viaGraph,
        detail: n114
          ? `NCR-114 (${n114.outcome}) injected via ${
              n114.via.graph
                ? n114.via.vector
                  ? "similarity+graph"
                  : "graph"
                : "similarity"
            }`
          : "NCR-114 precedent not assembled",
      };
    },
  },
  {
    id: "OFF-7",
    title: "moat — calibrated confidence corrects an over-confident case",
    tier: "offline",
    category: "moat",
    run: async () => {
      // The demo org is seeded systematically over-confident (agents ~0.9, ~60%
      // approved). CONF.1 must pull 0.9 down materially (~0.6).
      const model = await getCalibrationModel("org_axona_demo");
      const cal = calibratedConfidence(0.9, model);
      const corrected = cal.state === "calibrated" && cal.value < 0.75;
      return {
        pass: corrected,
        detail: `raw 0.90 → calibrated ${cal.value.toFixed(2)} (${cal.state})`,
      };
    },
  },
  {
    id: "OFF-8",
    title:
      "prompt-contract — the Axona prompt keeps its behavioral instructions",
    tier: "offline",
    category: "prompt-contract",
    run: async () => {
      // The regression EVAL.1 exists to catch: a prompt edit that drops the cite /
      // recall-precedent / no-fabrication / read-and-route contract. If any of these
      // instructions disappears, this case fails.
      const p = axonaSystemPrompt().toLowerCase();
      const contracts: [string, boolean][] = [
        ["cite the source objects", /cite the source/.test(p)],
        ["recall precedent (MEM.1a)", /recall/.test(p) && /precedent/.test(p)],
        ["getBlastRadius guidance", /getblastradius/.test(p)],
        [
          "no-fabrication",
          /never claim a result you did not get from a tool/.test(p),
        ],
        [
          "read-and-route (no act)",
          /do not draft|read and route|read; never/.test(p),
        ],
      ];
      const missing = contracts.filter(([, ok]) => !ok).map(([n]) => n);
      return {
        pass: missing.length === 0,
        detail:
          missing.length === 0
            ? "all 5 prompt contracts present (cite · recall-precedent · blast-radius · no-fabrication · read-and-route)"
            : `MISSING prompt contract(s): ${missing.join(", ")}`,
      };
    },
  },
];

// ── LIVE cases (opt-in: EVAL_LIVE=1 + a real key; never in the default gate) ──────

const live: EvalCase[] = [
  {
    id: "LIVE-1",
    title: "real model selects getBlastRadius for a blast-radius question",
    tier: "live",
    category: "tool-selection",
    run: async ({ demo }) => {
      if (!process.env.ANTHROPIC_API_KEY)
        return { pass: false, detail: "ANTHROPIC_API_KEY not set" };
      const trace = new TraceCollector();
      await runLoop(
        axonaDef(),
        "Trace the full blast radius of NCR-118 across every module.",
        ctxFor(demo, "org_axona_demo", trace),
        new AnthropicModelClient(),
      );
      const called = trace.lines.some(
        (l) => l.kind === "tool" && /getBlastRadius/.test(l.text),
      );
      return {
        pass: called,
        detail: called
          ? "real model called getBlastRadius"
          : "real model did NOT call getBlastRadius",
      };
    },
  },
  {
    id: "LIVE-2",
    title: "real model grounds its answer in the NCR-114 precedent",
    tier: "live",
    category: "grounding",
    run: async ({ demo }) => {
      if (!process.env.ANTHROPIC_API_KEY)
        return { pass: false, detail: "ANTHROPIC_API_KEY not set" };
      const trace = new TraceCollector();
      const res = await runLoop(
        axonaDef(),
        "Have we seen a servo defect like NCR-118 before, and how was it handled?",
        ctxFor(demo, "org_axona_demo", trace),
        new AnthropicModelClient(),
      );
      const grounded = /NCR-114/.test(res.text);
      return {
        pass: grounded,
        detail: grounded
          ? "answer cited the NCR-114 precedent"
          : "answer did not surface the precedent",
      };
    },
  },
];

export const ALL_CASES: EvalCase[] = [...offline, ...live];
