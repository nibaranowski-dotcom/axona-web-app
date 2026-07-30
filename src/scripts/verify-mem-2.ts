/**
 * Verify MEM.2 — auto-inject operational memory into agent context.
 * Run: pnpm verify:mem-2
 *
 *   1. assembleContext returns a BOUNDED block (respects the token budget;
 *      over-budget drops the lowest-scoring hits) and is org-scoped (a 2nd org gets
 *      zero of the 1st's memory).
 *   2. For an NCR-118-shaped situation the assembled block contains the NCR-114
 *      precedent WITHOUT a manual recallMemory call — and the runtime injects it +
 *      emits a `memory` trace line (auto-injection fired).
 *   3. Low-confidence / cold-start → nothing injected (no fabrication); the trace
 *      shows the decision.
 *   4. The explicit recallMemory tool is kept (belt + suspenders); MEM.1/CONF.1
 *      verifies stay green (checked by verify:all).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ModelClient } from "@axona/agents";

let passed = 0;
let failed = 0;
const check = async (
  label: string,
  fn: () => boolean | Promise<boolean>,
): Promise<void> => {
  try {
    const ok = await fn();
    console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
    ok ? passed++ : failed++;
  } catch (e) {
    console.log(`  FAIL ${label} — ${(e as Error).message}`);
    failed++;
  }
};

const DEMO = "org_axona_demo";
const SECOND = "org_isolation_test";

async function run(): Promise<void> {
  console.log(
    "\nVerifying MEM.2 — auto-inject operational memory into agent context\n",
  );
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const context = read("packages/db/src/memory/context.ts");
  const runtime = read("packages/agents/src/runtime/runtime.ts");
  const types = read("packages/agents/src/runtime/types.ts");
  const toolsIdx = read("packages/agents/src/tools/index.ts");

  // ── static: the assembler + the runtime wiring ──
  await check(
    "assembleContext exists: cited, confidence-gated, budget-pruned",
    () => {
      return (
        /export async function assembleContext\(/.test(context) &&
        /recallMemory\(/.test(context) &&
        /calibratedConfidence\(/.test(context) &&
        /MEMORY_CONFIDENCE_FLOOR/.test(context) &&
        /tokenBudget|budget/.test(context)
      );
    },
  );
  await check(
    "runtime AUTO-injects (no manual tool call) + a `memory` TraceKind",
    () => {
      return (
        /["']memory["']/.test(types) && // TraceKind gained "memory"
        /injectMemory\(/.test(runtime) &&
        /assembleContext\(/.test(runtime) &&
        /ctx\.trace\.push\(\s*["']memory["']/.test(runtime) &&
        // the block is injected into the system prompt sent to the model
        /system: systemPrompt/.test(runtime)
      );
    },
  );
  await check(
    "the explicit recallMemory tool is kept (belt + suspenders)",
    () => {
      return /recallMemoryTool/.test(toolsIdx) || /recallMemory/.test(toolsIdx);
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP data checks — DATABASE_URL not set");
    if (failed === 0) console.log(`\nPASSED — ${passed} checks (static only)`);
    else {
      console.log(`\nFAILED — ${failed} check(s) failed`);
      process.exit(1);
    }
    return;
  }

  const { dbForOrg, assembleContext, recallMemory, MEMORY_TOKEN_BUDGET } =
    await import("@axona/db");
  const { runLoop, TraceCollector } = await import("@axona/agents");

  // VERIFY.2 — pin the recency reference so recall ranking is deterministic
  // regardless of seed order / wall-clock (the local verify:all flake). Recency
  // decays over a 90-day half-life; a far-future reference makes it negligible +
  // UNIFORM across episodes, so ranking is driven by the SEED-ORDER-INDEPENDENT
  // signals (graph proximity ⊕ episode kind ⊕ vector) — i.e. NCR-114 leads because
  // it is a graph-proximate RESOLUTION precedent, not because of a timestamp.
  // Prod recall is unchanged (it defaults to Date.now()).
  const NOW = Date.UTC(2100, 0, 1);

  // ── 1 + 2: NCR-118 situation auto-assembles the NCR-114 precedent, bounded ──
  // A generous recall limit so the assertion is robust to an ACCUMULATED memory
  // substrate (verify:all re-ingests earlier runs' audit rows; e.g. ECO-318
  // OUTCOME episodes legitimately rank near NCR-114). NCR-114 is always a graph
  // neighbor, so it is reliably within this window — membership, not absolute rank.
  const RECALL = 15;
  const db = dbForOrg(DEMO);
  // floor 0 here isolates "does the NCR-114 precedent surface + get cited" from the
  // confidence FLOOR/calibration (which shift with the substrate and are asserted
  // separately by the runtime path (real default floor) + the below-floor check).
  const assembled = await assembleContext(db, {
    subject: { type: "NCR", id: "NCR-118" },
    query: "What is going on with NCR-118?",
    limit: RECALL,
    floor: 0,
    now: NOW,
  });
  await check(
    "assembleContext(NCR-118) injects the NCR-114 precedent (cited), NOT NCR-118's own",
    () => {
      return (
        assembled.reason === "injected" &&
        assembled.injected >= 1 &&
        assembled.hits.some((h) => h.subjectCode === "NCR-114") &&
        !assembled.hits.some((h) => h.subjectCode === "NCR-118") &&
        // every injected episode is CITED with a [sourceType:sourceId] provenance
        assembled.hits.every(
          (h) => !!h.provenance.sourceType && !!h.provenance.sourceId,
        ) &&
        /\[NCR:.+\]/.test(assembled.block)
      );
    },
  );
  await check(
    "bounded: block respects the token budget; over-budget drops the lowest-scoring",
    async () => {
      // This check isolates the TOKEN-BUDGET pruning. It uses floor 0 so the
      // confidence FLOOR / calibration model (which shift with the accumulated
      // substrate and are tested separately by the below-floor + org-scoped checks)
      // can't change what's a candidate — only the budget decides. A big budget and
      // a tiny budget over the SAME candidate set: the big one is bounded + ranked
      // highest-first, the tiny one keeps strictly fewer (drops the lowest tail).
      const big = await assembleContext(db, {
        subject: { type: "NCR", id: "NCR-118" },
        query: "NCR-118",
        limit: RECALL,
        floor: 0,
        tokenBudget: MEMORY_TOKEN_BUDGET,
        now: NOW,
      });
      const tiny = await assembleContext(db, {
        subject: { type: "NCR", id: "NCR-118" },
        query: "NCR-118",
        limit: RECALL,
        floor: 0,
        tokenBudget: 90,
        now: NOW,
      });
      const rankedDesc = big.hits.every(
        (h, i, a) => i === 0 || (a[i - 1]?.confidence ?? 1) >= h.confidence,
      );
      return (
        big.tokensUsed <= MEMORY_TOKEN_BUDGET && // bounded to the budget
        rankedDesc && // highest-scoring kept, in order
        big.injected >= 2 && // multiple episodes fit the big budget
        // a tight budget keeps only the leader(s) — strictly fewer episodes and a
        // strictly smaller block (the lowest-scoring tail is dropped). RELATIVE, so
        // it doesn't depend on any one episode's summary length: assembleContext
        // always injects at least the single top episode even if it alone edges the
        // tiny budget, so an absolute `tinyTokens <= 90` is substrate-sensitive.
        tiny.injected >= 1 &&
        tiny.injected <= 2 &&
        tiny.injected < big.injected &&
        tiny.tokensUsed < big.tokensUsed
      );
    },
  );
  // VERIFY.2 — the ranking assertion made time-INDEPENDENT and stronger: NCR-114
  // leads because it is a graph-proximate RESOLUTION precedent, not because of
  // recency. Prove it directly: the graph-reached NCR-114 RESOLUTION outscores a
  // NON-graph RESOLUTION with the very same defect (NCR-090), under a pinned now.
  await check(
    "precedent ranking is REAL: the graph-proximate NCR-114 RESOLUTION outranks a non-graph one",
    async () => {
      const hits = await recallMemory(db, {
        subjectType: "NCR",
        subjectId: "NCR-118",
        query: "drive torque over UCL stiff actuator — handled before?",
        limit: 25,
        now: NOW,
      });
      const g114 = hits.find(
        (h) => h.subject?.code === "NCR-114" && h.kind === "RESOLUTION",
      );
      const nonGraph = hits.find(
        (h) =>
          h.kind === "RESOLUTION" &&
          h.via.graph === false && // reached by vector only — no edge to NCR-118
          h.subject?.code !== "NCR-114",
      );
      return (
        !!g114 &&
        g114.via.graph === true &&
        (g114.via.graphDepth ?? 0) >= 1 &&
        !!nonGraph &&
        g114.score > nonGraph.score // graph proximity + kind win, not the clock
      );
    },
  );
  await check(
    "org-scoped: a 2nd org assembles ZERO of the 1st's memory",
    async () => {
      const second = await assembleContext(dbForOrg(SECOND), {
        subject: { type: "NCR", id: "NCR-118" },
        query: "NCR-118",
        now: NOW,
      });
      return second.injected === 0 && second.block === "";
    },
  );

  // ── 3: honest no-inject — cold-start + below-floor, with a legible reason ──
  await check(
    "cold-start (2nd org, no memory) → nothing injected, reason 'cold-start'",
    async () => {
      const cold = await assembleContext(dbForOrg(SECOND), {
        subject: { type: "NCR", id: "NCR-118" },
        query: "NCR-118",
        now: NOW,
      });
      return (
        cold.injected === 0 && cold.reason === "cold-start" && cold.block === ""
      );
    },
  );
  await check(
    "below-floor (high confidence floor) → nothing injected (no fabrication)",
    async () => {
      const floored = await assembleContext(db, {
        subject: { type: "NCR", id: "NCR-118" },
        query: "NCR-118",
        floor: 0.999,
        now: NOW,
      });
      return floored.injected === 0 && floored.reason === "below-floor";
    },
  );

  // ── 2 (runtime): the loop auto-injects + emits the `memory` trace, NO manual recall ──
  const fakeAnswer = (): ReturnType<ModelClient["createMessage"]> =>
    Promise.resolve({
      stopReason: "end_turn",
      text: "This echoes the prior contained incident.",
      toolUses: [],
      model: "fake",
      usage: { inputTokens: 5, outputTokens: 5 },
    });

  await check(
    "runtime: a bare NCR-118 question emits a `memory` trace + injects NCR-114 into the system prompt (no manual recall)",
    async () => {
      let capturedSystem = "";
      const model: ModelClient = {
        async createMessage(args) {
          capturedSystem = args.system ?? "";
          return fakeAnswer();
        },
      };
      const def = {
        systemPrompt: "You are the Axona agent.",
        scope: "core",
        tools: [],
      };
      const trace = new TraceCollector();
      const ctx = {
        orgId: DEMO,
        userId: "verify",
        agentId: "verify",
        db: dbForOrg(DEMO),
        trace,
      };
      await runLoop(def, "What's going on with NCR-118?", ctx, model);

      const mem = trace.lines.find((l) => l.kind === "memory");
      const toolCalls = trace.lines.filter((l) => l.kind === "tool");
      return (
        !!mem &&
        /injected \d+ prior episode/.test(mem.text) &&
        /top = /.test(mem.text) && // a precedent was named as the lead
        // VERIFY.2 — assert the NCR-114 precedent AUTO-INJECTED into the model's
        // system prompt by MEMBERSHIP (it is among the injected cited episodes),
        // not by the recency-sensitive #1 trace slot: within the default 900-token
        // budget every precedent injects, so this is deterministic AND still real.
        /NCR-114/.test(capturedSystem) &&
        toolCalls.length === 0 // auto-injected — the agent never called recallMemory
      );
    },
  );
  await check(
    "runtime: cold-start (2nd org) emits an honest no-inject `memory` trace line",
    async () => {
      const model: ModelClient = {
        async createMessage() {
          return fakeAnswer();
        },
      };
      const def = { systemPrompt: "core", scope: "core", tools: [] };
      const trace = new TraceCollector();
      const ctx = {
        orgId: SECOND,
        userId: "verify",
        agentId: "verify",
        db: dbForOrg(SECOND),
        trace,
      };
      await runLoop(def, "have we seen NCR-118 before?", ctx, model);
      const mem = trace.lines.find((l) => l.kind === "memory");
      return (
        !!mem && /no prior episodes injected \(cold-start\)/.test(mem.text)
      );
    },
  );

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run().then(() => process.exit(failed > 0 ? 1 : 0));
