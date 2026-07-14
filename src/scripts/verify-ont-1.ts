/**
 * Verify ONT.1 — entity-link graph + blast radius + the runSpcCheck fix.
 * Run: pnpm verify:ont-1  (needs the DB up + the demo seed applied).
 *
 *   1. EntityLink + enums exist (migration applied → table queryable).
 *   2. The seed creates the NCR-118 cascade: links resolve across ≥6 modules.
 *   3. getBlastRadius("NCR","NCR-118") → nodes from ≥5 modules, each a REAL record
 *      with a relation path; traversal is bidirectional + depth-capped.
 *   4. Generalization: getBlastRadius("NCR","NCR-114") returns its own (smaller)
 *      real cascade — nothing hardcoded to NCR-118.
 *   5. runSpcCheck({characteristic:"Drive torque"}) reports the SAME breaches the
 *      SPC chart renders (2 over UCL for drive_torque_Nm).
 *   6. Cross-tenant isolation: a second org sees zero of the first org's graph.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Stable seed org ids (packages/db/prisma/seed/constants.ts).
const DEMO_ORG_ID = "org_axona_demo";
const SECOND_ORG_ID = "org_isolation_test";
const REQUIRED_118 = [
  "Quality",
  "Engineering",
  "Procurement",
  "Manufacturing",
  "Fulfillment",
  "Field Service",
];

let passed = 0;
let failed = 0;
const check = async (label: string, fn: () => Promise<boolean> | boolean) => {
  try {
    const ok = await fn();
    console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
    ok ? passed++ : failed++;
  } catch (e) {
    console.log(`  FAIL ${label} — ${(e as Error).message}`);
    failed++;
  }
};

async function run() {
  console.log("\nVerifying ONT.1 — entity-link graph + blast radius\n");

  const root = process.cwd();
  const schema = existsSync(join(root, "packages/db/prisma/schema.prisma"))
    ? readFileSync(join(root, "packages/db/prisma/schema.prisma"), "utf8")
    : "";

  const { dbForOrg } = await import("@axona/db");
  const { getBlastRadius, runSpcCheck } = await import("@axona/agents");
  const db = dbForOrg(DEMO_ORG_ID);

  // 1. schema + migration
  await check(
    "EntityLink model + EntityType/LinkRelation enums in schema",
    () => {
      const body = schema.match(/model EntityLink \{([\s\S]*?)\n\}/)?.[1] ?? "";
      return (
        body.length > 0 &&
        /enum EntityType \{/.test(schema) &&
        /enum LinkRelation \{/.test(schema) &&
        // bidirectional indexes for fast BOTH-direction traversal
        /@@index\(\[orgId, toType, toId\]\)/.test(body) &&
        // moat pointer only — NO confidence/approver FIELD lines yet (comments ok)
        !/^\s+(confidence|approver)\s+\w/im.test(body)
      );
    },
  );
  await check(
    "EntityLink migration authored (migrate dev, not db push)",
    () => {
      const migs = existsSync(join(root, "packages/db/prisma/migrations"))
        ? readdirSync(join(root, "packages/db/prisma/migrations"))
        : [];
      const mig = migs.find((m) => /entity_link/.test(m));
      if (!mig) return false;
      const sql = readFileSync(
        join(root, "packages/db/prisma/migrations", mig, "migration.sql"),
        "utf8",
      );
      // clean additive migration — must NOT drop the raw-SQL FTS/vector objects
      return (
        /CREATE TABLE "EntityLink"/.test(sql) &&
        /CREATE TYPE "EntityType"/.test(sql) &&
        !/DROP COLUMN "tsv"|DROP INDEX "searchdoc/.test(sql)
      );
    },
  );
  await check("EntityLink table is queryable (migration applied)", async () => {
    return (await db.entityLink.count()) > 0;
  });

  // 2 + 3. NCR-118 cascade
  const r118 = await getBlastRadius(db, { entityType: "NCR", code: "NCR-118" });
  const modules118 = r118.groups.map((g) => g.module);
  await check("seed cascade: NCR-118 links resolve across ≥6 modules", () => {
    return (
      r118.found &&
      r118.moduleCount >= 6 &&
      REQUIRED_118.every((m) => modules118.includes(m))
    );
  });
  await check(
    "getBlastRadius(NCR-118): ≥5 modules, every node a real record",
    () => {
      const nodes = r118.groups.flatMap((g) => g.nodes);
      return (
        r118.moduleCount >= 5 &&
        nodes.length >= 8 &&
        nodes.every(
          (n) => n.code.length > 0 && n.label.length > 0 && n.path.length > 0,
        )
      );
    },
  );
  await check(
    "traversal is bidirectional (a path follows a reverse edge)",
    () => {
      // e.g. "NCR-118 —CAUSED_BY→ SERVO-204 ←CONTAINS— PO-9002" reaches PO via an
      // inbound edge — only possible if BFS walks edges in both directions.
      return r118.groups
        .flatMap((g) => g.nodes)
        .some((n) => /←\w+—/.test(n.path));
    },
  );
  await check(
    "depth-capped: maxDepth 1 returns fewer nodes than maxDepth 3",
    async () => {
      const shallow = await getBlastRadius(db, {
        entityType: "NCR",
        code: "NCR-118",
        maxDepth: 1,
      });
      return shallow.nodeCount < r118.nodeCount && shallow.nodeCount > 0;
    },
  );
  await check("path names the source (starts at NCR-118)", () => {
    return r118.groups
      .flatMap((g) => g.nodes)
      .every((n) => n.path.startsWith("NCR-118"));
  });

  // 4. generalization — NCR-114
  const r114 = await getBlastRadius(db, { entityType: "NCR", code: "NCR-114" });
  await check(
    "GENERALIZATION: NCR-114 returns its own real cascade (≥3 modules)",
    () => {
      return (
        r114.found &&
        r114.moduleCount >= 3 &&
        r114.groups.flatMap((g) => g.nodes).every((n) => n.code.length > 0)
      );
    },
  );
  await check("NCR-114 cascade is SMALLER than NCR-118 (not hardcoded)", () => {
    return r114.moduleCount < r118.moduleCount;
  });

  // 5. runSpcCheck agrees with the chart
  await check(
    "runSpcCheck('Drive torque') reports the chart's 2 breaches",
    async () => {
      const ctx = {
        orgId: DEMO_ORG_ID,
        userId: "verify",
        agentId: "verify",
        db,
        trace: { add: () => {} },
      } as never;
      const out = (await runSpcCheck.handler(
        { characteristic: "Drive torque" },
        ctx,
      )) as { characteristic: string; breaches: number; linkedNcr: unknown };
      // the chart's own breach count for the stored key
      const samples = await db.spcSample.findMany({
        where: { characteristic: "drive_torque_Nm" },
        select: { value: true, ucl: true, lcl: true },
      });
      const chartBreaches = samples.filter(
        (s) => s.value > s.ucl || s.value < s.lcl,
      ).length;
      return (
        out.characteristic === "drive_torque_Nm" &&
        out.breaches === chartBreaches &&
        chartBreaches === 2 &&
        out.linkedNcr != null
      );
    },
  );

  // 6. cross-tenant isolation
  await check(
    "isolation: second org sees zero of the first org's graph",
    async () => {
      const second = await getBlastRadius(dbForOrg(SECOND_ORG_ID), {
        entityType: "NCR",
        code: "NCR-118",
      });
      return second.nodeCount === 0;
    },
  );

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run().then(() => process.exit(0));
