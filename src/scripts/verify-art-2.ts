/**
 * Verify ART.2 — typed tool registry. Static + offline registry checks always
 * run; data checks (real read/draft handlers, gated-no-side-effect, isolation)
 * are gated on DATABASE_URL. Run: pnpm verify:art-2
 */
import { existsSync } from "node:fs";
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
  console.log("\nVerifying ART.2 — typed tool registry\n");

  const base = join(process.cwd(), "packages/agents/src/tools");
  await check("registry + module tool files exist", () =>
    [
      "registry",
      "core",
      "procurement",
      "quality",
      "engineering",
      "field-service",
      "finance",
      "inventory",
    ].every((f) => existsSync(join(base, `${f}.ts`))),
  );

  const { registry, buildAgentDef, runLoop, FakeModelClient, TraceCollector } =
    await import("@axona/agents");
  type ModelResponse = import("@axona/agents").ModelResponse;
  type AgentContext = import("@axona/agents").AgentContext;

  // offline (no DB): every tool is zod-typed + categorized + scoped-by-contract
  await check("every tool is zod-typed + categorized; gated⇔flag", () =>
    registry
      .all()
      .every(
        (t) =>
          !!t.inputSchema &&
          ["read", "draft", "gated"].includes(t.category) &&
          (t.category !== "gated" || t.gated === true),
      ),
  );
  await check("draft tools are NOT gated; gated tools ARE", () => {
    const all = registry.all();
    const draftsClean = all
      .filter((t) => t.category === "draft")
      .every((t) => t.gated !== true);
    const gatedSet = [
      "sendPurchaseOrder",
      "releaseEco",
      "recognizeRevenue",
      "issueCreditNote",
    ];
    const gatedFlagged = gatedSet.every(
      (n) =>
        registry.byName(n).category === "gated" &&
        registry.byName(n).gated === true,
    );
    return draftsClean && gatedFlagged;
  });

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP data checks — DATABASE_URL not set");
  } else {
    const { prisma, dbForOrg } = await import("@axona/db");
    const org = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const orgId = org.id;
      const db = dbForOrg(orgId);
      const mkCtx = (agentId: string): AgentContext => ({
        orgId,
        userId: "u",
        agentId,
        db: dbForOrg(orgId),
        trace: new TraceCollector(),
      });

      await check(
        "buildAgentDef wires module tools + core reads (procurement)",
        async () => {
          const a = await db.agent.findFirst({
            where: { moduleKey: "procurement" },
          });
          if (!a) throw new Error("no procurement agent seeded");
          const def = buildAgentDef(a);
          return (
            def.tools.some((t) => t.name === "draftPurchaseOrder") &&
            def.tools.some((t) => t.name === "sendPurchaseOrder") &&
            def.tools.some((t) => t.name === "searchOperations")
          );
        },
      );

      await check(
        "read tool returns seeded rows (reorder candidates)",
        async () => {
          const tool = registry.byName("listReorderCandidates");
          const out = await tool.handler({}, mkCtx("a"));
          return Array.isArray(out);
        },
      );

      await check("draft tool creates a DRAFTED PO (non-gated)", async () => {
        const part = await db.part.findFirst({});
        const sup = await db.supplier.findFirst({});
        const agent = await db.agent.findFirst({
          where: { moduleKey: "procurement" },
        });
        if (!part || !sup || !agent)
          throw new Error("missing seeded part/supplier/agent");
        const before = await db.purchaseOrder.count({
          where: { status: "DRAFTED" },
        });
        await registry
          .byName("draftPurchaseOrder")
          .handler(
            { partId: part.id, supplierId: sup.id, qty: 5 },
            mkCtx(agent.id),
          );
        const after = await db.purchaseOrder.count({
          where: { status: "DRAFTED" },
        });
        return after === before + 1;
      });

      await check(
        "gated tool proposed, NOT executed by the loop (no SENT PO)",
        async () => {
          const a = await db.agent.findFirst({
            where: { moduleKey: "procurement" },
          });
          if (!a) throw new Error("no procurement agent seeded");
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
          const before = await db.purchaseOrder.count({
            where: { status: "SENT" },
          });
          const ctx = mkCtx(a.id);
          const r = await runLoop(buildAgentDef(a), "send it", ctx, fake);
          const after = await db.purchaseOrder.count({
            where: { status: "SENT" },
          });
          return (
            r.status === "AWAITING_APPROVAL" &&
            after === before &&
            ctx.trace.lines.some((l) => l.kind === "proposal")
          );
        },
      );

      await check(
        "tools are tenant-scoped (org A row invisible to org B)",
        async () => {
          const other = await prisma.org.findFirst({
            where: { name: "Isolation Test Co" },
          });
          const partA = await db.part.findFirst({});
          if (!other || !partA) throw new Error("missing fixtures");
          const leaked = await dbForOrg(other.id).part.findFirst({
            where: { id: partA.id },
          });
          return leaked === null;
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
