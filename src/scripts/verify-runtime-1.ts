/**
 * Verify RUNTIME.1 — agent-loop hardening. Run: pnpm verify:runtime-1
 *
 *   1. CONTEXT PRUNING — an 8-turn run's CARRIED context is bounded, not linear in
 *      turns: older tool payloads are elided, only the recent window is verbatim.
 *      Asserted both directly (pruneMessages) and end-to-end (a recording client
 *      records what each model call actually receives).
 *   2. TOKEN-CAP HANDLING — a stop_reason:"max_tokens" response is surfaced as
 *      explicitly truncated (flag + visible marker), never a silent cut; the answer
 *      cap was raised off 1024.
 *   3. RUN OBSERVABILITY — AgentRun carries promptTokens/completionTokens/
 *      totalTokens populated from the model client's usage; migration present.
 *   4. Non-breaking + self-cleaning; per-tenant isolation intact.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { ModelClient, ModelMessage, ModelResponse } from "@axona/agents";
import { captureSeededState } from "./lib/self-clean";

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

async function run(): Promise<void> {
  console.log("\nVerifying RUNTIME.1 — agent-loop hardening\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const runtime = read("packages/agents/src/runtime/runtime.ts");
  const client = read("packages/agents/src/runtime/model-client.ts");
  const runAgentSrc = read("packages/agents/src/runtime/run-agent.ts");
  const schema = read("packages/db/prisma/schema.prisma");

  // ── static ──
  await check(
    "the loop sends a PRUNED transcript to the model each call",
    () => {
      return (
        /export function pruneMessages\(/.test(runtime) &&
        /messages: pruneMessages\(messages\)/.test(runtime)
      );
    },
  );
  await check("the answer token cap was raised off 1024 (env-tunable)", () => {
    return (
      !/max_tokens:\s*1024/.test(client) &&
      /resolveMaxTokens\(\)/.test(client) &&
      /ANTHROPIC_MAX_TOKENS/.test(client)
    );
  });
  await check(
    "max_tokens stop is handled explicitly (never a silent cut)",
    () => {
      return (
        /res\.stopReason === "max_tokens"/.test(runtime) &&
        /truncated/.test(runtime)
      );
    },
  );
  await check("AgentRun has nullable token columns + migration present", () => {
    const hasCols =
      /promptTokens\s+Int\?/.test(schema) &&
      /completionTokens\s+Int\?/.test(schema) &&
      /totalTokens\s+Int\?/.test(schema);
    const migDir = "packages/db/prisma/migrations";
    const mig = existsSync(join(root, migDir))
      ? readdirSync(join(root, migDir)).some((d) => /runtime1/.test(d))
      : false;
    return hasCols && mig && /promptTokens:\s*usage\?/.test(runAgentSrc);
  });

  // ── dynamic (loop behaviour) ──
  const { runLoop, pruneMessages, TraceCollector, runAgent } =
    await import("@axona/agents");
  const { dbForOrg, prisma } = await import("@axona/db");

  type MResponse = ModelResponse;
  type MClient = ModelClient;

  const BIG = "BIGPAYLOAD".repeat(600); // ~6KB per tool result

  // ── 1 (direct): pruneMessages elides older payloads, keeps the recent window ──
  await check("pruneMessages bounds a big synthetic transcript", () => {
    const msgs: ModelMessage[] = [{ role: "user", content: "the task" }];
    for (let i = 0; i < 7; i++) {
      msgs.push({
        role: "assistant",
        content: [{ type: "tool_use", id: `t${i}`, name: "big", input: {} }],
      });
      msgs.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: `t${i}`, content: BIG }],
      });
    }
    const pruned = pruneMessages(msgs);
    const fullSize = JSON.stringify(msgs).length;
    const prunedSize = JSON.stringify(pruned).length;
    const bigCount = JSON.stringify(pruned).split("BIGPAYLOAD").length - 1;
    const fullBig = JSON.stringify(msgs).split("BIGPAYLOAD").length - 1;
    // the task survives, the transcript shrinks, and only a bounded number of the
    // big payloads remain (the recent window) — NOT all 7.
    return (
      JSON.stringify(pruned).includes("the task") &&
      prunedSize < fullSize / 2 &&
      fullBig >= 7 * 600 &&
      bigCount <= 3 * 600
    );
  });

  // ── 1 (end-to-end): what the model actually RECEIVES stays bounded over turns ──
  await check(
    "an 8-turn run carries BOUNDED context (not linear in turns)",
    async () => {
      const carriedSizes: number[] = [];
      let lastCarried = "";
      let i = 0;
      const script: MResponse[] = [];
      for (let t = 0; t < 7; t++)
        script.push({
          stopReason: "tool_use",
          text: "",
          toolUses: [{ id: `c${t}`, name: "big", input: {} }],
          model: "fake",
          usage: { inputTokens: 10, outputTokens: 5 },
        });
      script.push({
        stopReason: "end_turn",
        text: "done",
        toolUses: [],
        model: "fake",
        usage: { inputTokens: 10, outputTokens: 5 },
      });

      const recording: MClient = {
        async createMessage(args) {
          const s = JSON.stringify(args.messages);
          carriedSizes.push(s.length);
          lastCarried = s;
          return script[Math.min(i++, script.length - 1)]!;
        },
      };

      const def = {
        systemPrompt: "test",
        scope: "test",
        tools: [
          {
            name: "big",
            description: "returns a big payload",
            category: "read" as const,
            inputSchema: z.object({}),
            handler: async () => ({ payload: BIG }),
          },
        ],
      };
      const ctx = {
        orgId: DEMO,
        userId: "verify",
        agentId: "verify",
        db: dbForOrg(DEMO),
        trace: new TraceCollector(),
      };

      const r = await runLoop(def, "trace this", ctx, recording);
      const turns = carriedSizes.length;
      const maxCarried = Math.max(...carriedSizes);
      const bigInLast = lastCarried.split("BIGPAYLOAD").length - 1;
      // ran the full loop; carried size never reached "all 7 payloads verbatim"
      // (~42KB); only the recent window kept the big payloads.
      return (
        turns >= 8 &&
        maxCarried < 7 * BIG.length * 0.6 &&
        bigInLast <= 3 * 600 &&
        r.usage !== null &&
        r.usage.totalTokens === r.usage.promptTokens + r.usage.completionTokens
      );
    },
  );

  // ── 2: a cap-hitting response is surfaced as truncated, never silently cut ──
  await check(
    "stop_reason:max_tokens → truncated flag + visible marker",
    async () => {
      let n = 0;
      const capClient: MClient = {
        async createMessage() {
          n++;
          return {
            stopReason: "max_tokens",
            text: "| a | b |\n| 1 | 2 ", // a table cut mid-row
            toolUses: [],
            model: "fake",
            usage: { inputTokens: 20, outputTokens: 1024 },
          };
        },
      };
      const def = { systemPrompt: "t", scope: "t", tools: [] };
      const ctx = {
        orgId: DEMO,
        userId: "verify",
        agentId: "verify",
        db: dbForOrg(DEMO),
        trace: new TraceCollector(),
      };
      const r = await runLoop(def, "long answer", ctx, capClient);
      return (
        n === 1 &&
        r.truncated === true &&
        /truncated/i.test(r.text) &&
        r.usage?.completionTokens === 1024
      );
    },
  );

  await check("a normal end_turn is NOT flagged truncated", async () => {
    const okClient: MClient = {
      async createMessage() {
        return {
          stopReason: "end_turn",
          text: "all good",
          toolUses: [],
          model: "fake",
          usage: { inputTokens: 5, outputTokens: 5 },
        };
      },
    };
    const ctx = {
      orgId: DEMO,
      userId: "verify",
      agentId: "verify",
      db: dbForOrg(DEMO),
      trace: new TraceCollector(),
    };
    const r = await runLoop(
      { systemPrompt: "t", scope: "t", tools: [] },
      "hi",
      ctx,
      okClient,
    );
    return r.truncated === false && r.text === "all good";
  });

  // ── 3: a real run persists token counts on AgentRun (self-cleaned) ──
  // DB-backed — skipped when no database is configured (e.g. the pre-push hook);
  // the loop checks above cover pruning + truncation + usage without a DB.
  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP AgentRun DB check — DATABASE_URL not set");
    if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
    else {
      console.log(`\nFAILED — ${failed} check(s) failed`);
      process.exit(1);
    }
    return;
  }

  await check(
    "runAgent persists promptTokens/completionTokens/totalTokens",
    async () => {
      const agent = await prisma.agent.findFirst({
        where: { orgId: DEMO },
        select: { id: true },
      });
      if (!agent) return false;
      const user = await prisma.user.findFirst({
        where: { orgId: DEMO },
        select: { id: true },
      });
      if (!user) return false;

      const guard = await captureSeededState(prisma as never, ["AgentRun"]);
      try {
        const fake: MClient = {
          async createMessage() {
            return {
              stopReason: "end_turn",
              text: "hello",
              toolUses: [],
              model: "fake",
              usage: { inputTokens: 123, outputTokens: 45 },
            };
          },
        };
        const res = await runAgent(agent.id, "hi", {
          orgId: DEMO,
          userId: user.id,
          model: fake,
        });
        const row = await prisma.agentRun.findUnique({
          where: { id: res.runId },
          select: {
            promptTokens: true,
            completionTokens: true,
            totalTokens: true,
          },
        });
        return (
          !!row &&
          row.promptTokens === 123 &&
          row.completionTokens === 45 &&
          row.totalTokens === 168 &&
          res.usage?.totalTokens === 168
        );
      } finally {
        await guard.restore();
      }
    },
  );

  await prisma.$disconnect();

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run().then(() => process.exit(failed > 0 ? 1 : 0));
