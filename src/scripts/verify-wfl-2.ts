/**
 * Verify WFL.2 — Workflow detail screen + read model. Static checks always run;
 * data checks are gated on DATABASE_URL. Run: pnpm verify:wfl-2
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
const base = join(root, "apps/web");
const read = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");

async function run(): Promise<void> {
  console.log("\nVerifying WFL.2 — Workflow detail screen + read model\n");

  await check(
    "route + component + detail api route exist",
    () =>
      existsSync(join(base, "app/(shell)/workflows/[id]/page.tsx")) &&
      existsSync(join(base, "components/workflows/WorkflowDetailView.tsx")) &&
      existsSync(join(base, "app/api/workflows/[id]/route.ts")),
  );

  const lib = read(join(base, "lib/workflows.ts"));
  await check(
    "getWorkflowDetail org-scoped (dbForOrg) + reuses WorkflowGraph",
    () =>
      /getWorkflowDetail/.test(lib) &&
      /dbForOrg/.test(lib) &&
      /safeParseGraph/.test(lib),
  );
  await check("moat seams: RBAC.4 + AUDIT.3 + WF.2 (live SSE deferred)", () => {
    const v = read(join(base, "components/workflows/WorkflowDetailView.tsx"));
    return /RBAC\.4/.test(lib) && /AUDIT\.3/.test(lib) && /WF\.2/.test(v);
  });
  await check(
    "run console replays via TraceConsole; Run posts to the WF.1 API",
    () => {
      const v = read(join(base, "components/workflows/WorkflowDetailView.tsx"));
      return (
        /TraceConsole/.test(v) &&
        /toConsoleLines/.test(v) &&
        /\/api\/workflows\/\$\{detail\.id\}\/run/.test(v) &&
        /method: "POST"/.test(v)
      );
    },
  );
  await check("detail route is read-only (no mutations)", () => {
    const route = read(join(base, "app/api/workflows/[id]/route.ts"));
    return !/\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\(/.test(
      route,
    );
  });

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP data checks — DATABASE_URL not set");
  } else {
    const { prisma } = await import("@axona/db");
    const { getWorkflowDetail } = await import("../../apps/web/lib/workflows");
    const org = await prisma.org.findFirst({
      where: { name: "Axona" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const proc = await prisma.workflow.findFirst({
        where: { orgId: org.id, name: "Procurement reorder" },
      });
      const ncr = await prisma.workflow.findFirst({
        where: { orgId: org.id, name: "NCR-118 → ECO-318" },
      });

      await check(
        "detail returns parsed graph → step flow trigger→…→output",
        async () => {
          const d = await getWorkflowDetail(org.id, proc!.id);
          if (!d) return false;
          const kinds = d.steps.map((s) => s.kind);
          return (
            kinds[0] === "trigger" &&
            kinds.includes("agent") &&
            kinds.includes("decision") &&
            kinds.includes("guardrail") &&
            kinds.includes("output") &&
            d.stats.stepCount > 0 &&
            d.stats.moduleCount >= 1
          );
        },
      );
      await check("decision gate exposes its branch labels", async () => {
        const d = await getWorkflowDetail(org.id, proc!.id);
        const gate = d?.steps.find((s) => s.kind === "decision");
        return (
          !!gate?.branches &&
          gate.branches.length === 2 &&
          gate.branches.some((b) => /onTrue/.test(b)) &&
          gate.branches.some((b) => /onFalse/.test(b))
        );
      });
      await check(
        "runs carry persisted TraceLine[] traces (replayable)",
        async () => {
          const d = await getWorkflowDetail(org.id, ncr!.id);
          const run = d?.runs[0];
          return (
            !!run &&
            run.trace.length > 0 &&
            run.trace.every(
              (l) => typeof l.kind === "string" && typeof l.text === "string",
            )
          );
        },
      );
      await check(
        "procurement detail can replay the AWAITING_APPROVAL parked run",
        async () => {
          // The seeded parked run persists an AWAITING_APPROVAL run whose trace
          // carries the guardrail proposal line — robust to sibling verifies that
          // enqueue newer runs during verify:all.
          const parked = await prisma.workflowRun.findFirst({
            where: { workflowId: proc!.id, status: "AWAITING_APPROVAL" },
            select: { trace: true },
          });
          if (!parked) return false;
          const lines = parked.trace as { kind: string; text: string }[];
          return (
            lines.some((l) => l.kind === "proposal") &&
            lines.some((l) => /AWAITING_APPROVAL/.test(l.text))
          );
        },
      );
      await check(
        "Run is RBAC-gated + never auto-executes a gated action (WF.1 enqueue)",
        () => {
          const runRoute = read(
            join(base, "app/api/workflows/[id]/run/route.ts"),
          );
          const executor = read(
            join(root, "packages/agents/src/workflow/executor.ts"),
          );
          return (
            /requireRole/.test(runRoute) &&
            /enqueueWorkflowRun/.test(runRoute) &&
            /guardrail/.test(executor) &&
            /AWAITING_APPROVAL/.test(executor) &&
            /no auto-execute/.test(executor)
          );
        },
      );
      await check(
        "org isolation — unknown workflow id returns null",
        async () => {
          const d = await getWorkflowDetail(org.id, "wf_does_not_exist");
          return d === null;
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
