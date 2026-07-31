/**
 * Verify DEMO.5 — make the RCA workspace reachable by click. The /rca/[ncrCode]
 * workspace was URL-only; DEMO.5 adds a visible, labelled "Open RCA →" entry point
 * from (a) the Quality NCR table and (b) the unit page's Open-issues panel — only for
 * NCRs that actually HAVE an RCA workspace, and read-visible to every role (the
 * classification WRITE stays RBAC-gated). Static checks always run; DB checks gate on
 * DATABASE_URL. Run: pnpm verify:demo-5
 *
 *   1. (static) NcrTable renders a Link to /rca/<code>, gated on hasRca.
 *   2. (static) the unit page's Open-issues panel renders the same, gated on hasRca.
 *   3. (static) both read models compute hasRca; the RCA route is read-visible (view
 *      not RBAC-gated) while the classify WRITE stays role-gated.
 *   4. (db) getQualityData: the NCR with an RCA workspace (NCR-118) has hasRca=true and
 *      a /rca link; an NCR without one has hasRca=false (link absent).
 *   5. (db) the unit linked to that NCR surfaces it as a hasRca issue (one-click reach).
 *   6. (db) orgId-scoped — another tenant's Quality data never carries NCR-118.
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
const decomment = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

async function run(): Promise<void> {
  console.log("\nVerifying DEMO.5 — RCA workspace reachable by click\n");

  await check(
    "Quality NCR table renders an 'Open RCA →' Link to /rca/<code>, gated on hasRca",
    () => {
      const t = decomment(read("apps/web/components/quality/NcrTable.tsx"));
      return (
        /n\.hasRca/.test(t) &&
        /href=\{`\/rca\/\$\{encodeURIComponent\(n\.code\)\}`\}/.test(t) &&
        /Open RCA/.test(t)
      );
    },
  );

  await check(
    "unit page Open-issues panel renders 'Open RCA →' to /rca/<code>, gated on hasRca",
    () => {
      const v = decomment(read("apps/web/components/units/UnitView.tsx"));
      return (
        /n\.hasRca/.test(v) &&
        /href=\{`\/rca\/\$\{encodeURIComponent\(n\.code\)\}`\}/.test(v) &&
        /Open RCA/.test(v)
      );
    },
  );

  await check(
    "both read models compute hasRca; RCA route is read-visible (view NOT write-gated)",
    () => {
      const quality = decomment(read("apps/web/lib/quality.ts"));
      const unit = decomment(read("apps/web/lib/unit-detail.ts"));
      const route = decomment(
        read("apps/web/app/(shell)/rca/[ncrCode]/page.tsx"),
      );
      return (
        /hasRca: !!\(n\.testRunId \|\| n\.configSnapshot\)/.test(quality) &&
        /hasRca: !!\(n\.testRunId \|\| n\.configSnapshot\)/.test(unit) &&
        // the page renders the workspace for any signed-in user (no requireRole gate
        // on VIEW) while the classify write stays role-gated (canClassify via hasRole).
        /getRcaWorkspace\(user\.orgId/.test(route) &&
        !/requireRole/.test(route) &&
        /canClassify=\{hasRole\(/.test(route)
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP db checks — DATABASE_URL not set (static only)");
    finish();
    return;
  }

  const { prisma, dbForOrg } = await import("@axona/db");
  const { getQualityData } = await import("../../apps/web/lib/quality");
  const { getUnitDetail } = await import("../../apps/web/lib/unit-detail");

  const org = await prisma.org.findFirst({ where: { name: "Axona" } });
  const org2 = await prisma.org.findFirst({
    where: { name: "Isolation Test Co" },
  });
  if (!org) {
    console.log("  FAIL demo org missing (run pnpm db:seed)");
    failed++;
    await prisma.$disconnect();
    finish();
    return;
  }

  // ── 4 · the read model computes hasRca: the RCA NCR true, another false ──────
  const quality = await getQualityData(org.id);
  const rcaNcr = quality.ncrs.find((n) => n.hasRca);
  const plainNcr = quality.ncrs.find((n) => !n.hasRca);
  await check(
    "getQualityData: an NCR with an RCA workspace has hasRca=true; one without has hasRca=false",
    () => !!rcaNcr && !!plainNcr && rcaNcr.code !== plainNcr.code,
  );
  await check("the RCA NCR is NCR-118 (the golden-thread failure)", () => {
    return rcaNcr?.code === "NCR-118";
  });

  // ── 5 · the unit linked to that NCR surfaces it as a hasRca issue ────────────
  await check(
    "the unit linked to NCR-118 surfaces it as a one-click 'Open RCA' issue",
    async () => {
      if (!rcaNcr) return false;
      const db = dbForOrg(org.id);
      const ncr = await db.nCR.findFirst({
        where: { code: rcaNcr.code },
        select: { id: true },
      });
      if (!ncr) return false;
      // find a UNIT the NCR links to (either edge direction), via the ontology graph.
      const links = await db.entityLink.findMany({
        where: {
          OR: [
            { fromType: "NCR", fromId: ncr.id, toType: "UNIT" },
            { toType: "NCR", toId: ncr.id, fromType: "UNIT" },
          ],
        },
      });
      const unitId =
        links.find((l) => l.toType === "UNIT")?.toId ??
        links.find((l) => l.fromType === "UNIT")?.fromId;
      if (!unitId) return false;
      const unitRow = await db.unit.findFirst({
        where: { id: unitId },
        select: { serial: true },
      });
      if (!unitRow) return false;
      const detail = await getUnitDetail(org.id, unitRow.serial);
      const issue = detail?.issues.find((i) => i.code === rcaNcr.code);
      return !!issue && issue.hasRca === true;
    },
  );

  // ── 6 · org isolation — another tenant's Quality never carries NCR-118 ───────
  if (org2) {
    await check(
      "orgId-scoped: another tenant's Quality data never carries NCR-118",
      async () => {
        const q2 = await getQualityData(org2.id);
        return !q2.ncrs.some((n) => n.code === "NCR-118");
      },
    );
  }

  await prisma.$disconnect();
  finish();
}

function finish(): void {
  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
