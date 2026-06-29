/**
 * Verify ART.1 — AgentRuntime. Fully offline via FakeModelClient (no API key).
 * Static file checks always run; data checks are gated on DATABASE_URL (CI-safe).
 * Run: pnpm verify:art-1
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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

async function run(): Promise<void> {
  console.log("\nVerifying ART.1 — AgentRuntime\n");

  const base = join(process.cwd(), "packages/agents/src");
  await check("runtime files exist", () =>
    ["runtime", "types", "model-client", "trace", "run-agent"].every((f) =>
      existsSync(join(base, "runtime", `${f}.ts`)),
    ),
  );
  await check("example tools + gated stub exist", () =>
    existsSync(join(base, "tools", "index.ts")),
  );
  await check("no hardcoded model literal in the loop/run-agent", () => {
    // The model name must come from env (model-client.ts only). A stale literal
    // in the loop or entry point silently breaks calls.
    const loop = readFileSync(join(base, "runtime", "runtime.ts"), "utf8");
    const entry = readFileSync(join(base, "runtime", "run-agent.ts"), "utf8");
    return !/claude-[a-z0-9-]+/.test(loop) && !/claude-[a-z0-9-]+/.test(entry);
  });
  await check("model name + key read from env", () => {
    const mc = readFileSync(join(base, "runtime", "model-client.ts"), "utf8");
    return /ANTHROPIC_MODEL/.test(mc) && /ANTHROPIC_API_KEY/.test(mc);
  });

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP data checks — DATABASE_URL not set");
  } else {
    const { prisma, dbForOrg } = await import("@axona/db");
    const { runLoop, runAgent, FakeModelClient, TraceCollector, testDef } =
      await import("@axona/agents");
    type ModelResponse = import("@axona/agents").ModelResponse;
    type AgentContext = import("@axona/agents").AgentContext;

    const org = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const orgId = org.id;
      const ctx = (agentId: string): AgentContext => ({
        orgId,
        userId: "u",
        agentId,
        db: dbForOrg(orgId),
        trace: new TraceCollector(),
      });

      // 1. loop: tool_use then final text → SUCCEEDED, trace has tool + result lines
      await check("loop executes a read-only tool then finishes", async () => {
        const fake = new FakeModelClient([
          {
            stopReason: "tool_use",
            text: "",
            model: "fake",
            toolUses: [{ id: "t1", name: "listOpenNcrs", input: {} }],
          },
          {
            stopReason: "end_turn",
            text: "There is at least one open NCR.",
            model: "fake",
            toolUses: [],
          },
        ] satisfies ModelResponse[]);
        const c = ctx("a");
        const r = await runLoop(
          testDef(["listOpenNcrs"]),
          "any open NCRs?",
          c,
          fake,
        );
        return (
          r.status === "SUCCEEDED" &&
          c.trace.lines.some((l) => l.kind === "tool") &&
          c.trace.lines.some((l) => l.kind === "tool-result") &&
          c.trace.lines.some((l) => l.kind === "result")
        );
      });

      // 2. gating: a gated tool is proposed, NOT executed (no PO sent).
      // (draftPurchaseOrder became a draft tool in ART.2; sendPurchaseOrder is
      // the gated one.)
      await check("gated tool is proposed, not executed", async () => {
        const fake = new FakeModelClient([
          {
            stopReason: "tool_use",
            text: "",
            model: "fake",
            toolUses: [
              {
                id: "t1",
                name: "sendPurchaseOrder",
                input: { poId: "x" },
              },
            ],
          },
        ] satisfies ModelResponse[]);
        const before = await dbForOrg(orgId).purchaseOrder.count();
        const c = ctx("a");
        const r = await runLoop(
          testDef(["sendPurchaseOrder"]),
          "send it",
          c,
          fake,
        );
        const after = await dbForOrg(orgId).purchaseOrder.count();
        return (
          r.status === "AWAITING_APPROVAL" &&
          after === before &&
          c.trace.lines.some((l) => l.kind === "proposal")
        );
      });

      // 3. turn cap → FAILED
      await check("turn cap ends the run", async () => {
        const loopResp: ModelResponse = {
          stopReason: "tool_use",
          text: "",
          model: "fake",
          toolUses: [{ id: "t", name: "listOpenNcrs", input: {} }],
        };
        const fake = new FakeModelClient(
          Array.from({ length: 20 }, () => loopResp),
        );
        const c = ctx("a");
        const r = await runLoop(testDef(["listOpenNcrs"]), "loop", c, fake);
        return (
          r.status === "FAILED" && c.trace.lines.some((l) => l.kind === "error")
        );
      });

      // 4. persistence: runAgent writes an AgentRun with trace + model
      await check(
        "runAgent persists an AgentRun with trace + model",
        async () => {
          const agent = await dbForOrg(orgId).agent.findFirst({});
          if (!agent) throw new Error("no seeded agent");
          const fake = new FakeModelClient([
            {
              stopReason: "end_turn",
              text: "ok",
              model: "fake-sonnet",
              toolUses: [],
            },
          ] satisfies ModelResponse[]);
          const r = await runAgent(agent.id, "hi", {
            orgId,
            userId: "u",
            model: fake,
          });
          const row = await dbForOrg(orgId).agentRun.findFirst({
            where: { id: r.runId },
          });
          return (
            !!row &&
            Array.isArray(row.trace) &&
            JSON.stringify(row.trace).includes("fake-sonnet") &&
            r.status === "SUCCEEDED"
          );
        },
      );

      // 5. tenant isolation: an agent in org A is not loadable from org B
      await check("runAgent is tenant-scoped (no cross-org load)", async () => {
        const other = await prisma.org.findFirst({
          where: { name: "Isolation Test Co" },
        });
        const agent = await dbForOrg(orgId).agent.findFirst({});
        if (!other || !agent) throw new Error("missing fixtures");
        const fake = new FakeModelClient([
          { stopReason: "end_turn", text: "x", model: "fake", toolUses: [] },
        ] satisfies ModelResponse[]);
        try {
          await runAgent(agent.id, "hi", {
            orgId: other.id,
            userId: "u",
            model: fake,
          });
          return false; // should have thrown
        } catch {
          return true;
        }
      });
    }

    await prisma.$disconnect();
  }

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
