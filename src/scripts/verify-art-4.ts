/**
 * Verify ART.4 — agent chat SSE. Static checks always run; the trace-sink
 * contract the route depends on is exercised offline via FakeModelClient. The
 * live HTTP/SSE path is a manual check. Run: pnpm verify:art-4
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
  console.log("\nVerifying ART.4 — agent chat SSE\n");

  const root = process.cwd();
  await check(
    "route + client helper exist",
    () =>
      existsSync(join(root, "apps/web/app/api/agents/[id]/chat/route.ts")) &&
      existsSync(join(root, "apps/web/lib/agent-chat.ts")),
  );
  await check("TraceCollector supports a sink (onLine)", () =>
    /onLine/.test(
      readFileSync(join(root, "packages/agents/src/runtime/trace.ts"), "utf8"),
    ),
  );
  await check("route streams SSE event types + scoped lookups", () => {
    const src = readFileSync(
      join(root, "apps/web/app/api/agents/[id]/chat/route.ts"),
      "utf8",
    );
    return (
      /text\/event-stream/.test(src) &&
      /event: \$\{event\}/.test(src) &&
      /"proposal"/.test(src) &&
      /dbForOrg/.test(src) &&
      /status: 404/.test(src)
    );
  });

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP data checks — DATABASE_URL not set");
  } else {
    const { prisma, dbForOrg } = await import("@axona/db");
    const { runAgent, FakeModelClient } = await import("@axona/agents");
    type ModelResponse = import("@axona/agents").ModelResponse;

    const org = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const db = dbForOrg(org.id);

      await check(
        "onTrace streams lines live (sink fires during the run)",
        async () => {
          const agent = await db.agent.findFirst({
            where: { moduleKey: "procurement" },
          });
          if (!agent) throw new Error("no procurement agent seeded");
          const seen: string[] = [];
          const fake = new FakeModelClient([
            { stopReason: "end_turn", text: "ok", model: "fake", toolUses: [] },
          ] satisfies ModelResponse[]);
          await runAgent(agent.id, "hello", {
            orgId: org.id,
            userId: "u",
            model: fake,
            onTrace: (l) => seen.push(l.kind),
          });
          return seen.includes("scan") && seen.includes("result");
        },
      );

      await check(
        "back-compat: no onTrace behaves like ART.1 (still persists a run)",
        async () => {
          const agent = await db.agent.findFirst({});
          if (!agent) throw new Error("no agent");
          const fake = new FakeModelClient([
            { stopReason: "end_turn", text: "ok", model: "fake", toolUses: [] },
          ] satisfies ModelResponse[]);
          const r = await runAgent(agent.id, "hi", {
            orgId: org.id,
            userId: "u",
            model: fake,
          });
          const row = await db.agentRun.findFirst({ where: { id: r.runId } });
          return !!row && r.status === "SUCCEEDED";
        },
      );

      await check(
        "gated call streams a proposal kind, no SENT PO side effect",
        async () => {
          const agent = await db.agent.findFirst({
            where: { moduleKey: "procurement" },
          });
          if (!agent) throw new Error("no procurement agent seeded");
          const before = await db.purchaseOrder.count({
            where: { status: "SENT" },
          });
          const seen: string[] = [];
          const fake = new FakeModelClient([
            {
              stopReason: "tool_use",
              text: "",
              model: "fake",
              toolUses: [
                { id: "t", name: "sendPurchaseOrder", input: { poId: "x" } },
              ],
            },
          ] satisfies ModelResponse[]);
          const r = await runAgent(agent.id, "send it", {
            orgId: org.id,
            userId: "u",
            model: fake,
            onTrace: (l) => seen.push(l.kind),
          });
          const after = await db.purchaseOrder.count({
            where: { status: "SENT" },
          });
          return (
            seen.includes("proposal") &&
            r.status === "AWAITING_APPROVAL" &&
            after === before
          );
        },
      );
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
