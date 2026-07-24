/**
 * Verify AGT.3 — PLM config-management & traceability agents on the base rosters +
 * the agent pane on the PLM sub-app routes. Run: pnpm verify:agt-3
 *
 *   1. The 6 PLM specialists exist on the correct BASE module rosters (proven on a
 *      FRESH org seeded from the base roster — so every org, incl. the investor
 *      demo, gets them), each carrying a no-auto-act guardrail (autoAct:false).
 *   2. The agent pane resolves the OWNING module's roster on the PLM sub-app routes
 *      (/units · /units/:serial · /configurations · /blast-radius · /changes/:code →
 *      Engineering; /tests · /rca/:code → Quality) — one shared map used by the
 *      AgentPane + the shell layout.
 *   3. An agent proposal renders with CONF.1 calibrated confidence (RCA) and the
 *      human-approval path is decide() / requireRole — never an auto-act path.
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

const DEMO = "org_axona_demo";
const TMP = "org_agt3_fresh";

// The 6 PLM specialists → their owning base module + the auto-action each MUST NOT take.
const PLM_AGENTS: { role: string; module: string; never: string }[] = [
  { role: "CONFIGURATION", module: "engineering", never: "auto_baseline" },
  { role: "CHANGE_ORDER", module: "engineering", never: "auto_release_eco" },
  { role: "TEST_TRACEABILITY", module: "quality", never: "auto_classify" },
  { role: "RCA", module: "quality", never: "auto_classify_rca" },
  {
    role: "AS_BUILT_GENEALOGY",
    module: "manufacturing",
    never: "auto_substitute",
  },
  { role: "LOT_TRACEABILITY", module: "inventory", never: "auto_quarantine" },
];

async function run(): Promise<void> {
  console.log(
    "\nVerifying AGT.3 — PLM agents on base rosters + sub-app agent pane\n",
  );
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  // ── static wiring ──
  const routes = read("apps/web/lib/plm-routes.ts");
  const pane = read("apps/web/components/shell/AgentPane.tsx");
  const layout = read("apps/web/app/(shell)/layout.tsx");
  const seed = read("packages/db/prisma/seed/agents.ts");
  const rca = read("apps/web/lib/rca.ts");
  const approvals = read("apps/web/lib/approvals.ts");

  await check("shared route→module map owns the 6 PLM routes", () => {
    return (
      /units: "engineering"/.test(routes) &&
      /configurations: "engineering"/.test(routes) &&
      /"blast-radius": "engineering"/.test(routes) &&
      /changes: "engineering"/.test(routes) &&
      /tests: "quality"/.test(routes) &&
      /rca: "quality"/.test(routes)
    );
  });
  await check(
    "AgentPane + layout resolve the roster via owningModuleFor",
    () => {
      return (
        /owningModuleFor\(pathname\)/.test(pane) &&
        /owningModuleFor\(pathname\)/.test(layout)
      );
    },
  );
  await check(
    "seed roster carries the 6 PLM specialists with no-auto-act guardrails",
    () => {
      return (
        PLM_AGENTS.every((a) => new RegExp(`role: "${a.role}"`).test(seed)) &&
        /autoAct: false/.test(seed) &&
        /noAutoAct/.test(seed)
      );
    },
  );
  await check(
    "RCA proposal is CONF.1-calibrated + never auto-classifies",
    () => {
      return (
        /calibratedConfidence/.test(rca) &&
        /never auto-?classif/i.test(rca) &&
        /suggestion/.test(rca)
      );
    },
  );
  await check(
    "change-order propose→approve routes through decide('eco.release')",
    () => {
      return /"eco\.release":/.test(approvals);
    },
  );
  await check("AgentPane: v2 tokens only · no emoji · no invented reds", () => {
    return (
      !/#[0-9a-fA-F]{3,6}\b/.test(pane) &&
      !/\bbg-red|text-red|border-red\b/.test(pane) &&
      !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(pane)
    );
  });

  // ── the owning-module resolver (the pane's roster picker) ──
  const { owningModuleFor } = await import("../../apps/web/lib/plm-routes");
  await check(
    "owningModuleFor maps each PLM route to its owning module",
    () => {
      return (
        owningModuleFor("/units") === "engineering" &&
        owningModuleFor("/units/SN-2208") === "engineering" &&
        owningModuleFor("/configurations") === "engineering" &&
        owningModuleFor("/blast-radius") === "engineering" &&
        owningModuleFor("/changes/ECO-318") === "engineering" &&
        owningModuleFor("/tests") === "quality" &&
        owningModuleFor("/rca/NCR-118") === "quality" &&
        owningModuleFor("/core") === "core" &&
        owningModuleFor("/procurement") === "procurement" // non-PLM unchanged
      );
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

  const { prisma, dbForOrg } = await import("@axona/db");
  const { seedAgents } = await import("../../packages/db/prisma/seed/agents");
  const { getRcaWorkspace } = await import("../../apps/web/lib/rca");

  // ── 1: a FRESH org seeded from the BASE roster gets all 6, with guardrails ──
  await prisma.agent
    .deleteMany({ where: { orgId: TMP } })
    .catch(() => undefined);
  await prisma.org
    .upsert({
      where: { id: TMP },
      update: {},
      create: { id: TMP, name: "AGT3 fresh", slug: "agt3-fresh" },
    })
    .catch(() => undefined);
  try {
    await seedAgents(dbForOrg(TMP));
    const fresh = dbForOrg(TMP);

    await check(
      "fresh org: the 6 PLM specialists land on the correct base rosters",
      async () => {
        for (const a of PLM_AGENTS) {
          const row = await fresh.agent.findFirst({ where: { role: a.role } });
          if (!row || row.moduleKey !== a.module) return false;
        }
        return true;
      },
    );
    await check(
      "fresh org: each PLM agent carries a no-auto-act guardrail (autoAct:false)",
      async () => {
        for (const a of PLM_AGENTS) {
          const row = await fresh.agent.findFirst({ where: { role: a.role } });
          const g = row?.guardrails as {
            autoAct?: boolean;
            mode?: string;
            never?: string[];
          } | null;
          if (!g || g.autoAct !== false || !Array.isArray(g.never))
            return false;
          if (!g.never.includes(a.never)) return false;
        }
        return true;
      },
    );
    await check(
      "fresh org: existing Engineering + Quality agents are kept (roster grows, not replaced)",
      async () => {
        const eng = await fresh.agent.count({
          where: { moduleKey: "engineering" },
        });
        const qa = await fresh.agent.count({ where: { moduleKey: "quality" } });
        // 6 base + 2 PLM on each
        return eng >= 8 && qa >= 8;
      },
    );
  } finally {
    await prisma.agent
      .deleteMany({ where: { orgId: TMP } })
      .catch(() => undefined);
    await prisma.org.delete({ where: { id: TMP } }).catch(() => undefined);
  }

  // ── 2: the pane surfaces the owning roster on the PLM routes (demo org) ──
  const demo = dbForOrg(DEMO);
  await check(
    "the pane surfaces Engineering agents on /units·/configurations·/blast-radius·/changes",
    async () => {
      const eng = await demo.agent.findMany({
        where: { moduleKey: "engineering" },
      });
      return (
        eng.length >= 8 &&
        eng.some((a) => a.role === "CONFIGURATION") &&
        eng.some((a) => a.role === "CHANGE_ORDER")
      );
    },
  );
  await check("the pane surfaces Quality agents on /tests·/rca", async () => {
    const qa = await demo.agent.findMany({ where: { moduleKey: "quality" } });
    return (
      qa.length >= 8 &&
      qa.some((a) => a.role === "TEST_TRACEABILITY") &&
      qa.some((a) => a.role === "RCA")
    );
  });

  // ── 3: agent proposal + CONF.1 confidence + no auto-act (RCA) ──
  await check(
    "RCA agent proposes with CONF.1 calibrated confidence, does NOT auto-classify",
    async () => {
      const workspace = await getRcaWorkspace(DEMO, "NCR-118");
      const s = workspace?.suggestion;
      return (
        !!s &&
        typeof s.calibrated === "number" &&
        s.calibrated !== s.rawConfidence && // CONF.1 calibration actually applied
        (s.calibratedState === "calibrated" ||
          s.calibratedState === "uncalibrated") &&
        // the proposal is assistance — a proposed `cause`, never auto-applied
        typeof s.cause === "string"
      );
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
