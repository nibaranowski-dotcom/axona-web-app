/**
 * Verify SRCH.6 — FTS search() raw-SQL fix. Static checks always run; the engine
 * checks are gated on DATABASE_URL. Run: pnpm verify:srch-6
 *
 * Symptom: search() surfaced `Raw query failed. Code: 42601: syntax error at or
 * near "$N"`. ROOT CAUSE (confirmed by reproducing in the bundled Next.js server —
 * tsx never hit it): interpolating a `Prisma.sql` / `Prisma.empty` FRAGMENT (the
 * scope clause; and the tsquery fragment in countByType) into `$queryRaw`. Next
 * bundles a SECOND copy of `@prisma/client`, so a fragment built in @axona/db isn't
 * recognised by the bundled `$queryRaw` — instead of expanding it mis-binds as a
 * stray `$N` placeholder, shifting the params and breaking the SQL. Fix: NO
 * fragments — every interpolation is a plain value (scope bound as a nullable value,
 * NULL ⇒ all; the tsquery evaluated once in a CTE and referenced twice). After the
 * fix: search() returns real FTS hits, the agent searchOperations tool returns
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

  // --- static: the ROOT CAUSE is gone — NO Prisma.sql/Prisma.empty FRAGMENTS ---
  // (a fragment built in @axona/db isn't recognised by Next's duplicate-bundled
  // `$queryRaw`, so it mis-binds as a stray `$N` → 42601). Every interpolation is
  // now a plain value.
  await check(
    "query.ts uses NO Prisma.sql / Prisma.empty / Prisma.raw fragments (+ import removed)",
    () => {
      // strip comments (they legitimately mention the removed fragments)
      const code = q
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "");
      return (
        !/\bPrisma\.(sql|empty|raw|join)\b/.test(code) &&
        !/import\s*\{[^}]*\bPrisma\b[^}]*\}\s*from\s*"@prisma\/client"/.test(
          code,
        )
      );
    },
  );
  await check(
    "search() binds scope as a NULLABLE VALUE (NULL ⇒ all), not a fragment",
    () => {
      const body = q.slice(
        q.indexOf("export async function search"),
        q.indexOf("export async function moduleSearch"),
      );
      return (
        /scope === "ALL" \? null : scope/.test(body) &&
        /\$\{scopeParam\}::text AS scope/.test(body) &&
        /q\.scope IS NULL OR "type" = q\.scope::"SearchType"/.test(body) &&
        // tsquery evaluated once in the CTE, referenced by both sites
        /websearch_to_tsquery\('english', \$\{term\}\) AS tsq/.test(body) &&
        /ts_rank\("tsv", q\.tsq\)/.test(body) &&
        /"tsv" @@ q\.tsq/.test(body)
      );
    },
  );
  await check(
    "countByType() inlines the tsquery (plain-value bind, no fragment)",
    () => {
      const body = q.slice(q.indexOf("export async function countByType"));
      return (
        /"tsv" @@ websearch_to_tsquery\('english', \$\{term\}\)/.test(body) &&
        !/const tsquery = /.test(body)
      );
    },
  );
  await check(
    "semanticSearch() binds the query vector ONCE via a CTE (no double interpolation)",
    () => {
      const body = q.slice(q.indexOf("export async function semanticSearch"));
      return (
        /WITH v AS \(SELECT \$\{lit\}::vector AS qv\)/.test(body) &&
        /embedding <=> v\.qv/.test(body) &&
        !/\$\{lit\}::vector\)\)::float8[\s\S]*\$\{lit\}::vector/.test(body)
      );
    },
  );

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
      where: { name: "Axona" },
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
          ).handler({ query: "Tier-1 Auto OEM order" }, { orgId, db: prisma });
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
