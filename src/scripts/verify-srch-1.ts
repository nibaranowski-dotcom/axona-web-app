/**
 * Verify SRCH.1 — unified search index.
 * Run: pnpm verify:srch-1   (data checks require a seeded + reindexed DB)
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;
const root = process.cwd();
const read = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");

async function check(
  label: string,
  fn: () => boolean | Promise<boolean>,
): Promise<void> {
  try {
    const ok = await fn();
    console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
    ok ? passed++ : failed++;
  } catch (e) {
    console.log(`  FAIL ${label} — ${(e as Error).message}`);
    failed++;
  }
}

async function run(): Promise<void> {
  console.log("\nVerifying SRCH.1 — unified search index\n");
  const db = join(root, "packages/db");

  const schema = read(join(db, "prisma/schema.prisma"));
  await check(
    "SearchDoc model + SearchType enum",
    () => /model SearchDoc/.test(schema) && /enum SearchType/.test(schema),
  );
  await check("FTS migration has tsvector + GIN", () => {
    const dir = join(db, "prisma/migrations");
    const sql = readdirSync(dir)
      .flatMap((d) => {
        const p = join(dir, d, "migration.sql");
        return existsSync(p) ? [read(p)] : [];
      })
      .join("\n");
    return (
      /tsvector/.test(sql) &&
      /USING gin/.test(sql) &&
      /vector\(1536\)/.test(sql)
    );
  });
  await check(
    "search + semanticSearch + reindex present",
    () =>
      /export async function search/.test(
        read(join(db, "src/search/query.ts")),
      ) &&
      /export async function semanticSearch/.test(
        read(join(db, "src/search/query.ts")),
      ) &&
      existsSync(join(db, "src/search/reindex.ts")),
  );
  await check(
    "FTS is parameterized (websearch_to_tsquery + Prisma.sql, no $queryRawUnsafe)",
    () => {
      const q = read(join(db, "src/search/query.ts"));
      return (
        /websearch_to_tsquery\('english', \$\{term\}\)/.test(q) &&
        /Prisma\.(sql|empty)/.test(q) &&
        !/\$queryRawUnsafe/.test(q)
      );
    },
  );
  await check("seed calls reindex", () =>
    /reindex\(/.test(read(join(db, "prisma/seed.ts"))),
  );

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP data checks — DATABASE_URL not set");
  } else {
    const { prisma, search, semanticSearch } = await import("@axona/db");
    const demo = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    const second = await prisma.org.findFirst({
      where: { name: "Isolation Test Co" },
    });
    if (!demo || !second) {
      await check("demo + second orgs seeded", () => false);
    } else {
      await check(
        "modules indexed as global (orgId NULL) === 22",
        async () =>
          (await prisma.searchDoc.count({
            where: { type: "MODULE", orgId: null },
          })) === 22,
      );
      await check(
        "agents indexed for demo org (>= 60)",
        async () =>
          (await prisma.searchDoc.count({
            where: { type: "AGENT", orgId: demo.id },
          })) >= 60,
      );
      await check("FTS finds the sourcing agent", async () => {
        const r = await search(demo.id, "sourcing");
        return r.hits.some((h) => h.type === "AGENT");
      });
      await check("FTS finds the Quality module", async () => {
        const r = await search(demo.id, "quality");
        return r.hits.some((h) => h.type === "MODULE");
      });
      await check("results grouped by type (byType)", async () => {
        const r = await search(demo.id, "torque");
        return Object.keys(r.byType).length >= 1 && r.hits.length >= 1;
      });
      // TIGHTENED isolation: a second-org search returns ZERO docs with the demo orgId.
      await check(
        "isolation: second-org search returns 0 docs carrying the demo orgId",
        async () => {
          const r = await search(second.id, "sourcing", { limit: 50 });
          return r.hits.every((h) => h.orgId !== demo.id);
        },
      );
      // Globals are shared across tenants.
      await check(
        "globals shared: second org still sees the Quality module",
        async () => {
          const r = await search(second.id, "quality", { limit: 50 });
          return r.hits.some((h) => h.type === "MODULE" && h.orgId === null);
        },
      );
      await check(
        "semanticSearch returns [] (deferred to FILE.2)",
        async () => (await semanticSearch(demo.id, "anything")).length === 0,
      );
    }
    await prisma.$disconnect();
  }

  if (failed === 0) {
    console.log(`\nPASSED — ${passed} checks`);
  } else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

void run();
