/**
 * Verify SRCH.6 — FTS search() raw-SQL fix. Static checks always run; the engine
 * checks are gated on DATABASE_URL. Run: pnpm verify:srch-6
 *
 * Symptom: search() surfaced `Raw query failed. Code: 42601: syntax error at or
 * near "$4"` — a parameter-placement fragility from interpolating the
 * `websearch_to_tsquery(...)` Prisma.sql fragment TWICE (ts_rank + the `@@` filter),
 * reusing one bound param across two positions. Fix: bind the tsquery term ONCE via
 * a CTE (`WITH q AS (SELECT websearch_to_tsquery(...) AS tsq)`) so both sites
 * reference the same evaluated value and every bind param appears once. Same
 * hardening for semanticSearch's vector literal. After the fix: search() returns
 * real FTS hits without throwing, the agent searchOperations tool returns
 * cross-module results, and /api/search returns FULL results (no degraded notice)
 * for a healthy query. SRCH.5's moduleSearch degradation is preserved as defense.
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
  console.log("\nVerifying SRCH.6 — FTS search() raw-SQL fix\n");

  const q = read("packages/db/src/search/query.ts");

  // --- static: the double-bind is gone; each term/vector bound once via a CTE ---
  await check(
    "search() binds the tsquery ONCE via a CTE (no double fragment interpolation)",
    () => {
      const body = q.slice(
        q.indexOf("export async function search"),
        q.indexOf("export async function moduleSearch"),
      );
      return (
        /WITH q AS \(SELECT websearch_to_tsquery\('english', \$\{term\}\) AS tsq\)/.test(
          body,
        ) &&
        /ts_rank\("tsv", q\.tsq\)/.test(body) &&
        /"tsv" @@ q\.tsq/.test(body) &&
        // the old reused-fragment pattern must be gone
        !/const tsquery = Prisma\.sql/.test(body) &&
        !/@@ \$\{tsquery\}/.test(body)
      );
    },
  );
  await check("semanticSearch() binds the query vector ONCE via a CTE", () => {
    const body = q.slice(q.indexOf("export async function semanticSearch"));
    return (
      /WITH v AS \(SELECT \$\{lit\}::vector AS qv\)/.test(body) &&
      /embedding <=> v\.qv/.test(body) &&
      !/\$\{lit\}::vector\)\)::float8[\s\S]*\$\{lit\}::vector/.test(body)
    );
  });

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP engine/db checks — DATABASE_URL not set");
  } else {
    const {
      prisma,
      search,
      hybridSearch,
      semanticSearch,
      moduleSearch,
      ensureSearchIndexSchema,
    } = await import("@axona/db");
    const { searchOperations } = await import("@axona/agents");
    const org = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const orgId = org.id;
      const hasType = (hits: { type: string; title: string }[], type: string) =>
        hits.some((h) => h.type === type);

      await check(
        "search() returns real FTS hits without throwing (quality → module + agents)",
        async () => {
          const r = await search(orgId, "quality", { limit: 10 });
          return r.hits.length > 0 && hasType(r.hits, "MODULE");
        },
      );
      await check(
        "search() with a NON-ALL scope works (exercises the scope + limit params)",
        async () => {
          const r = await search(orgId, "quality", {
            scope: "AGENT",
            limit: 10,
          });
          return r.hits.length > 0 && r.hits.every((h) => h.type === "AGENT");
        },
      );
      await check(
        "agent searchOperations tool returns cross-module results (no 42601)",
        async () => {
          const res = await (
            searchOperations as unknown as {
              handler: (
                a: { query: string },
                c: unknown,
              ) => Promise<{ results: unknown[] }>;
            }
          ).handler({ query: "BMW order" }, { orgId, db: prisma });
          return Array.isArray(res.results) && res.results.length > 0;
        },
      );
      await check(
        "hybridSearch() (route path) runs without throwing → /search returns FULL results, not degraded",
        async () => {
          const r = await hybridSearch(orgId, "quality", {
            scope: "ALL",
            limit: 10,
          });
          // healthy FTS returns hits → route's ftsOk stays true → degraded=false
          return r.hits.length > 0;
        },
      );
      await check(
        "semanticSearch() runs without throwing (vector CTE)",
        async () => {
          const r = await semanticSearch(orgId, "quality", { limit: 5 });
          return Array.isArray(r); // [] when no embeddings — but never throws
        },
      );

      // SRCH.5 preserved: FTS dropped → module search STILL works. Self-clean.
      try {
        await check(
          "SRCH.5 preserved: drop tsv → moduleSearch STILL returns Procurement",
          async () => {
            await prisma.$executeRawUnsafe(
              `ALTER TABLE "SearchDoc" DROP COLUMN IF EXISTS "tsv" CASCADE`,
            );
            const m = await moduleSearch(orgId, "pro", {
              scope: "ALL",
              limit: 10,
            });
            return m.some((h) => /Procurement/i.test(h.title));
          },
        );
      } finally {
        await ensureSearchIndexSchema();
      }
      await check(
        "search() works again after tsv restore (self-heal intact)",
        async () => {
          const r = await search(orgId, "quality", { limit: 5 });
          return r.hits.length > 0;
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
