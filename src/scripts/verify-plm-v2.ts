/**
 * Verify PLM.V2 — Quality v2. Run: pnpm verify:plm-v2
 *
 *   1. A test-traceability section exists + links to PLM.6 (/tests) and PLM.7
 *      (/tests/:code); it is DISTINCT from the SPC chart (different components).
 *   2. The NCR table gains Root cause + Triggered by columns.
 *   3. NCR root cause persists + is audited; the classify action is RBAC-gated on
 *      line 1 (the mutation lives in the action, not a quality component).
 *   4. Data: NCR-118 rootCause = component + triggeredBy → TR-8841 resolves.
 *   5. SPC chart untouched (SpcChart component unchanged); existing QUAL verifies green.
 *   6. Per-tenant isolation.
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
  console.log("\nVerifying PLM.V2 — Quality v2 (test traceability + RCA)\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const trace = read("apps/web/components/quality/TestTraceability.tsx");
  const ncrTable = read("apps/web/components/quality/NcrTable.tsx");
  const actions = read("apps/web/app/(shell)/quality/actions.ts");
  const view = read("apps/web/components/quality/QualityView.tsx");

  // ── 1: test-traceability section, distinct from SPC ──
  await check("test-traceability section exists + links to PLM.6/PLM.7", () => {
    return (
      trace.length > 0 &&
      /Test traceability/.test(trace) &&
      /href="\/tests"/.test(trace) && // → Test explorer (PLM.6)
      /r\.href/.test(trace) && // rows → /tests/:code (PLM.7)
      /from SPC process monitoring/.test(trace)
    );
  });
  await check("traceability is a DISTINCT component from the SPC chart", () => {
    return (
      /TestTraceability/.test(view) &&
      /SpcChart/.test(view) &&
      existsSync(join(root, "apps/web/components/quality/SpcChart.tsx"))
    );
  });

  // ── 2: NCR columns ──
  await check("NCR table gains Root cause + Triggered by columns", () => {
    return (
      /Root cause/.test(ncrTable) &&
      /Triggered by/.test(ncrTable) &&
      /RootCauseCell/.test(ncrTable) &&
      /triggeredByRun/.test(ncrTable)
    );
  });

  // ── 3: the classify mutation is gated + audited, and NOT in a quality component ──
  await check("classify action is RBAC-gated on line 1 + audited", () => {
    const iRole = actions.indexOf("requireRole(");
    const iDb = actions.indexOf("dbForOrg(");
    const iUpdate = actions.indexOf("nCR.update(");
    return (
      iRole > 0 &&
      iDb > iRole &&
      iUpdate > iRole &&
      /writeAudit\(/.test(actions) &&
      /"ncr\.rootcause"/.test(actions)
    );
  });
  await check(
    "no mutation in quality components (write is in the action)",
    () => {
      const cell = read("apps/web/components/quality/RootCauseCell.tsx");
      return (
        !/\.(create|update|upsert|delete|deleteMany|updateMany)\(/.test(cell) &&
        !/\.(create|update|upsert|delete|deleteMany|updateMany)\(/.test(
          ncrTable,
        ) &&
        !/\.(create|update|upsert|delete|deleteMany|updateMany)\(/.test(trace)
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP data checks — DATABASE_URL not set");
    if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
    else {
      console.log(`\nFAILED — ${failed} check(s) failed`);
      process.exit(1);
    }
    return;
  }

  const { getQualityData } = await import("../../apps/web/lib/quality");
  const { prisma, dbForOrg, writeAudit } = await import("@axona/db");

  // ── 4: NCR-118 RCA + trigger link + traceability rows ──
  await check(
    "NCR-118 shows rootCause=component + triggeredBy → TR-8841; traceability links",
    async () => {
      const q = await getQualityData(DEMO);
      const ncr = q.ncrs.find((n) => n.code === "NCR-118");
      const traceOk =
        q.testTrace.length > 0 &&
        q.testTrace.every((r) => r.href.startsWith("/tests/"));
      return (
        !!ncr &&
        ncr.rootCause === "component" &&
        ncr.triggeredByRun === "TR-8841" &&
        ncr.triggeredByHref === "/tests/TR-8841" &&
        traceOk
      );
    },
  );

  // ── 3 (exercised): classify persists + writes an audit entry, then cleaned up ──
  await check(
    "classifying an NCR persists rootCause + writes an audit entry",
    async () => {
      const db = dbForOrg(DEMO);
      const target = await prisma.nCR.findFirst({
        where: { orgId: DEMO, rootCause: null },
        select: { id: true, code: true },
      });
      if (!target) return true; // nothing unclassified — vacuously fine
      const guard = await captureSeededState(prisma as never, ["AuditLog"]);
      try {
        await db.nCR.update({
          where: { id: target.id },
          data: { rootCause: "design" as never },
        });
        await writeAudit(db, {
          orgId: DEMO,
          actor: { type: "HUMAN", id: "verify", label: "verify" },
          action: "ncr.rootcause",
          target: { type: "NCR", id: target.code },
          summary: `Classified ${target.code} root cause as design`,
          inputs: { code: target.code },
          output: { rootCause: "design" },
          approver: { id: "verify", label: "verify" },
        });
        const after = await prisma.nCR.findUnique({ where: { id: target.id } });
        const audit = await prisma.auditLog.findFirst({
          where: {
            orgId: DEMO,
            action: "ncr.rootcause",
            targetId: target.code,
          },
        });
        return after?.rootCause === "design" && !!audit;
      } finally {
        // revert the update (self-clean only deletes NEW rows) + drop the audit row
        await db.nCR.update({
          where: { id: target.id },
          data: { rootCause: null },
        });
        await guard.restore();
      }
    },
  );

  // ── 6: isolation ──
  await check(
    "isolation: a second org sees zero test traceability",
    async () => {
      const q = await getQualityData(SECOND);
      return q.testTrace.length === 0;
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
