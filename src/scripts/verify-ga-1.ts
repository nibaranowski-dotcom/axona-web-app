/**
 * Verify GA.1 — general Axona agent + global pane. Static checks always run; the
 * scoped agent/tools checks are gated on DATABASE_URL. Live chat is a manual check.
 * Run: pnpm verify:ga-1
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

const root = process.cwd();
const read = (p: string) =>
  existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

async function run(): Promise<void> {
  console.log("\nVerifying GA.1 — general Axona agent\n");

  await check(
    "axona agent def + readToolsAcrossModules exist",
    () =>
      existsSync(join(root, "packages/agents/src/agents/axona.ts")) &&
      /readToolsAcrossModules/.test(
        read("packages/agents/src/tools/registry.ts"),
      ),
  );
  await check(
    "agent pane wired to the Axona chat (useAgentChat + axonaAgentId)",
    () =>
      // module-aware pane: chat body is PaneChat (useAgentChat); AgentPane
      // resolves the Axona agent on Core routes via axonaAgentId.
      /useAgentChat/.test(read("apps/web/components/shell/PaneChat.tsx")) &&
      /axonaAgentId/.test(read("apps/web/components/shell/AgentPane.tsx")),
  );
  await check("shell resolves getAxonaAgent + passes to pane", () =>
    /getAxonaAgent/.test(read("apps/web/app/(shell)/layout.tsx")),
  );
  await check("ChatThread renders citations as links", () => {
    const t = read("apps/web/components/agents/ChatThread.tsx");
    return /citations/.test(t) && /href=/.test(t);
  });
  await check("chat route attaches citations from tool sources", () => {
    const t = read("apps/web/app/api/agents/[id]/chat/route.ts");
    return /citationsFromTrace/.test(t) && /sources/.test(t);
  });
  await check("no-emoji instruction in both system prompts", () => {
    const axona = read("packages/agents/src/agents/axona.ts");
    const reg = read("packages/agents/src/tools/registry.ts");
    return /[Dd]o not use emoji/.test(axona) && /[Dd]o not use emoji/.test(reg);
  });

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP data checks — DATABASE_URL not set");
  } else {
    const { prisma, dbForOrg } = await import("@axona/db");
    const { buildAgentDef, getAxonaAgent } = await import("@axona/agents");
    const org = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const orgId = org.id;

      await check("axona agent exists (scope core), idempotent", async () => {
        const a = await getAxonaAgent(orgId);
        const b = await getAxonaAgent(orgId);
        return !!a && a.moduleKey === "core" && a.id === b.id;
      });
      await check(
        "axona agent has read tools only (no draft/gated)",
        async () => {
          const a = await getAxonaAgent(orgId);
          const def = buildAgentDef(a);
          return (
            def.tools.length > 0 &&
            def.tools.every((t) => t.category === "read")
          );
        },
      );
      await check("read tools span multiple modules", async () => {
        const a = await getAxonaAgent(orgId);
        const def = buildAgentDef(a);
        return (
          def.tools.some((t) => t.name === "searchOperations") &&
          def.tools.some((t) => t.name === "listOpenNcrs") &&
          def.tools.some((t) => t.name === "getUnitEconomics")
        );
      });
      await check("axona is tenant-scoped (org A agent ≠ org B)", async () => {
        const other = await prisma.org.findFirst({
          where: { name: "Isolation Test Co" },
        });
        if (!other) throw new Error("second org missing");
        const a = await getAxonaAgent(orgId);
        const leaked = await dbForOrg(other.id).agent.findFirst({
          where: { id: a.id },
        });
        return leaked === null;
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
