/**
 * Verify SRCH.2 — /api/search endpoint + countByType.
 * Run: pnpm verify:srch-2   (data checks require a seeded + reindexed DB)
 */
import { existsSync, readFileSync } from "node:fs";
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
  console.log("\nVerifying SRCH.2 — /api/search endpoint\n");
  const routePath = join(root, "apps/web/app/api/search/route.ts");
  const route = read(routePath);
  const queryFile = read(join(root, "packages/db/src/search/query.ts"));

  await check(
    "route handler exists (GET)",
    () => existsSync(routePath) && /export async function GET/.test(route),
  );
  await check(
    "route reads q + scope from searchParams",
    () =>
      /searchParams/.test(route) &&
      /["']q["']/.test(route) &&
      /scope/.test(route),
  );
  await check(
    "route resolves org via getCurrentUser + calls search",
    () => /getCurrentUser/.test(route) && /search\(/.test(route),
  );
  await check(
    "route returns counts (via countByType)",
    () => /countByType/.test(route) && /counts/.test(route),
  );
  await check(
    "countByType exported + parameterized + org-scoped",
    () =>
      /export async function countByType/.test(queryFile) &&
      /websearch_to_tsquery\('english', \$\{term\}\)/.test(queryFile) &&
      /"orgId" = \$\{orgId\} OR "orgId" IS NULL/.test(queryFile),
  );

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP data checks — DATABASE_URL not set");
  } else {
    const { prisma, search, countByType } = await import("@axona/db");
    const demo = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    const second = await prisma.org.findFirst({
      where: { name: "Isolation Test Co" },
    });
    if (!demo || !second) {
      await check("demo + second orgs seeded", () => false);
    } else {
      await check("search('sourcing') returns ranked hits", async () => {
        const r = await search(demo.id, "sourcing");
        return r.hits.length >= 1 && r.hits.some((h) => h.type === "AGENT");
      });
      await check(
        "counts.ALL >= hits.length and equals per-type sum",
        async () => {
          const c = await countByType(demo.id, "quality");
          const r = await search(demo.id, "quality", { limit: 50 });
          const sum = Object.entries(c)
            .filter(([k]) => k !== "ALL")
            .reduce((a, [, v]) => a + v, 0);
          return (c.ALL ?? 0) === sum && (c.ALL ?? 0) >= r.hits.length;
        },
      );
      await check(
        "counts ignore scope/limit (ALL >= a single-type count)",
        async () => {
          const c = await countByType(demo.id, "quality");
          return (
            (c.ALL ?? 0) >= (c.MODULE ?? 0) && (c.ALL ?? 0) >= (c.AGENT ?? 0)
          );
        },
      );
      await check("empty query → counts.ALL === 0, no hits", async () => {
        const c = await countByType(demo.id, "   ");
        const r = await search(demo.id, "   ");
        return (c.ALL ?? 0) === 0 && r.hits.length === 0;
      });
      await check(
        "isolation: second-org search returns 0 docs with the demo orgId",
        async () => {
          const r = await search(second.id, "sourcing", { limit: 50 });
          return r.hits.every((h) => h.orgId !== demo.id);
        },
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
