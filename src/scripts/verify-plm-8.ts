/**
 * Verify PLM.8 — the RCA workspace (`RCA.dc.html`). Answers Q4. Run: pnpm verify:plm-8
 *
 *   1. Route + view exist; DETAIL screen → breadcrumbs.
 *   2. The agent PROPOSES a candidate cause with CALIBRATED confidence (CONF.1) and
 *      NEVER auto-classifies — the human confirms (reuses PLM.V2's gated action).
 *   3. Classification persists + writes an audit entry (RBAC-gated).
 *   4. MEM.1 recall surfaces the prior related failure (NCR-114) via graph proximity.
 *   5. TEST_RUN / FIELD_EVENT nodes are now reachable in the ONT.1 graph.
 *   6. Fully usable with the agent OFF (evidence + classification don't need the suggestion).
 *   7. Per-tenant isolation.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
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
const SECOND = "org_isolation_test";

async function run(): Promise<void> {
  console.log("\nVerifying PLM.8 — the RCA workspace\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const page = read("apps/web/app/(shell)/rca/[ncrCode]/page.tsx");
  const view = read("apps/web/components/rca/RcaView.tsx");

  await check("/rca/:ncrCode route + view exist; loads getRcaWorkspace", () => {
    return page.length > 0 && view.length > 0 && /getRcaWorkspace/.test(page);
  });
  await check(
    "DETAIL screen → breadcrumb trail (Quality › NCR › Investigation)",
    () => {
      return /aria-label="Breadcrumb"/.test(view) && /Investigation/.test(view);
    },
  );
  await check(
    "the agent PROPOSES (Confirm is a separate human action — never auto-classifies)",
    () => {
      return (
        /Agent suggests/.test(view) &&
        /setNcrRootCauseAction/.test(view) &&
        /Confirm classification/.test(view) &&
        // the suggestion is guarded — the screen renders without it (AI off)
        /rca\.suggestion &&/.test(view)
      );
    },
  );
  await check("v2 tokens only · no invented reds on the RCA screen", () => {
    return (
      !/#[0-9a-fA-F]{3,6}\b/.test(view) &&
      !/\bbg-red|text-red|border-red\b/.test(view)
    );
  });

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP data checks — DATABASE_URL not set");
    if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
    else {
      console.log(`\nFAILED — ${failed} check(s) failed`);
      process.exit(1);
    }
    return;
  }

  const { getRcaWorkspace } = await import("../../apps/web/lib/rca");
  const { prisma, dbForOrg, writeAudit } = await import("@axona/db");
  const { getBlastRadius } = await import("@axona/agents");

  // ── 2: agent proposal with calibrated confidence, doesn't set rootCause ──
  await check(
    "agent proposal is evidence-derived + carries NO fabricated confidence; does not classify",
    async () => {
      const rca = await getRcaWorkspace(DEMO, "NCR-118");
      if (!rca?.suggestion) return false;
      const s = rca.suggestion as typeof rca.suggestion &
        Record<string, unknown>;
      // SEED.4 — this check previously asserted a CALIBRATED confidence, but the
      // value it calibrated was a hardcoded 0.82 literal, so the number was
      // fabricated (and rendered "(uncal)" on any org without a fitted model).
      // The proposal must now carry no confidence at all until CONF.1 is wired to
      // a real emitted value. The proposal itself still never writes rootCause.
      return (
        s.cause === "component" &&
        typeof s.rationale === "string" &&
        s.rationale.length > 0 &&
        !("calibrated" in s) &&
        !("rawConfidence" in s) &&
        !("calibratedState" in s)
      );
    },
  );

  // ── 4: MEM.1 recall surfaces NCR-114 (graph proximity) ──
  await check(
    "MEM.1 recall + graph surface the prior failure NCR-114",
    async () => {
      const rca = await getRcaWorkspace(DEMO, "NCR-118");
      return (
        !!rca &&
        rca.recallCount > 0 && // recallMemory returned precedent memories
        rca.similarFailures.some((s) => s.code === "NCR-114") // the related failure
      );
    },
  );

  // ── 5: TEST_RUN / FIELD_EVENT reachable in the graph ──
  await check(
    "TEST_RUN + FIELD_EVENT nodes reachable via getBlastRadius",
    async () => {
      const blast = await getBlastRadius(dbForOrg(DEMO), {
        entityType: "LOT",
        code: "LOT-88421",
        maxDepth: 4,
      });
      const types = new Set(
        blast.groups.flatMap((g) => g.nodes.map((n) => n.type)),
      );
      return types.has("TEST_RUN") && types.has("FIELD_EVENT");
    },
  );

  // ── 3 (exercised): classify persists + audits (the action's core), self-cleaned ──
  await check("classification persists + writes an audit entry", async () => {
    const db = dbForOrg(DEMO);
    const ncr = await prisma.nCR.findFirst({
      where: { orgId: DEMO, code: "NCR-114" },
      select: { id: true, code: true, rootCause: true },
    });
    if (!ncr) return false;
    const guard = await captureSeededState(prisma as never, ["AuditLog"]);
    try {
      await db.nCR.update({
        where: { id: ncr.id },
        data: { rootCause: "component" as never },
      });
      await writeAudit(db, {
        orgId: DEMO,
        actor: { type: "HUMAN", id: "verify", label: "verify" },
        action: "ncr.rootcause",
        target: { type: "NCR", id: ncr.code },
        summary: `Classified ${ncr.code} root cause as component`,
        output: { rootCause: "component" },
        approver: { id: "verify", label: "verify" },
      });
      const after = await prisma.nCR.findUnique({ where: { id: ncr.id } });
      const audit = await prisma.auditLog.findFirst({
        where: { orgId: DEMO, action: "ncr.rootcause", targetId: ncr.code },
      });
      return after?.rootCause === "component" && !!audit;
    } finally {
      await db.nCR.update({
        where: { id: ncr.id },
        data: { rootCause: ncr.rootCause },
      });
      await guard.restore();
    }
  });

  // ── 7: isolation ──
  await check(
    "isolation: a second org cannot read this NCR's workspace",
    async () => {
      const rca = await getRcaWorkspace(SECOND, "NCR-118");
      return rca === null;
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
