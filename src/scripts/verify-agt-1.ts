/**
 * Verify AGT.1 — Agents screen. Static checks always run; the scoped roster
 * count is gated on DATABASE_URL. The live chat is a manual check.
 * Run: pnpm verify:agt-1
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
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
const base = join(root, "apps/web");
const read = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");

async function run(): Promise<void> {
  console.log("\nVerifying AGT.1 — Agents screen\n");

  await check(
    "agents route + components exist",
    () =>
      existsSync(join(base, "app/(shell)/agents/page.tsx")) &&
      ["AgentsView", "AgentCard", "AgentChat", "ChatThread"].every((c) =>
        existsSync(join(base, `components/agents/${c}.tsx`)),
      ),
  );
  await check("chat uses streamAgentChat (ART.4)", () =>
    /streamAgentChat/.test(read(join(base, "components/agents/AgentChat.tsx"))),
  );
  await check("status dot maps AgentState (no red)", () => {
    const t = read(join(base, "components/agents/AgentCard.tsx"));
    return /CRITICAL/.test(t) && /ink/.test(t) && !/red|#f00|ff0000/i.test(t);
  });
  await check("proposal events surfaced as awaiting-approval", () => {
    const t = read(join(base, "components/agents/AgentChat.tsx"));
    return /proposal/.test(t) && /[Aa]waiting approval/.test(t);
  });
  await check("roster scoped via dbForOrg + grouped by module", () => {
    const t = read(join(base, "app/(shell)/agents/page.tsx"));
    return /dbForOrg/.test(t) && /moduleKey/.test(t);
  });
  await check("renders trace live (not buffered to done)", () => {
    const t = read(join(base, "components/agents/AgentChat.tsx"));
    // trace/proposal events update the console immediately; not gated on "done".
    return /setTraceLines/.test(t) && !/done/.test(t);
  });
  await check("no emoji / no raw hex in agents components", () => {
    const all = readdirSync(join(base, "components/agents"))
      .map((f) => read(join(base, "components/agents", f)))
      .join("\n");
    return (
      !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(all) &&
      !/#[0-9a-fA-F]{3,6}\b/.test(all)
    );
  });

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP data checks — DATABASE_URL not set");
  } else {
    const { prisma, dbForOrg } = await import("@axona/db");
    const org = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    await check("agents roster scoped + seeded (>= 60)", async () => {
      if (!org) throw new Error("demo org not seeded");
      return (await dbForOrg(org.id).agent.count()) >= 60;
    });
    await prisma.$disconnect();
  }

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
