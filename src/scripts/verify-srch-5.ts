/**
 * Verify SRCH.5 — robust, FTS-independent module search. Static wiring checks
 * always run; the engine checks are gated on DATABASE_URL. Run: pnpm verify:srch-5
 *
 * The recurring "Search unavailable" regression: after a schema op disturbs the
 * raw-SQL `SearchDoc.tsv`, the FTS query 500s and the whole palette blanks out.
 * Durable fix: (a) MODULE search queries the Module table directly — it never
 * touches `tsv`, so a module always surfaces; (b) the route self-heals the tsv
 * and, failing that, DEGRADES to a 200 with whatever it has — a 503 only when
 * module search AND FTS are both down. This script proves (a) by dropping `tsv`
 * and confirming moduleSearch still returns Procurement, then self-cleans.
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
  console.log("\nVerifying SRCH.5 — FTS-independent module search\n");

  // --- static wiring ---
  await check(
    "moduleSearch queries the Module table directly (no tsv dependency)",
    () => {
      const q = read("packages/db/src/search/query.ts");
      const start = q.indexOf("export async function moduleSearch");
      if (start < 0) return false;
      const rest = q.slice(start + "export async function moduleSearch".length);
      const end = rest.indexOf("\n}"); // moduleSearch's own closing brace (col 0)
      const body = end >= 0 ? rest.slice(0, end) : rest;
      return (
        /prisma\.module\.findMany/.test(body) &&
        /mode:\s*"insensitive"/.test(body) &&
        // the function body must NOT touch the FTS tsv/tsquery machinery
        !/\btsv\b/.test(body) &&
        !/tsquery/.test(body)
      );
    },
  );
  await check("moduleSearch is exported from @axona/db", () => {
    return /moduleSearch/.test(read("packages/db/src/index.ts"));
  });
  await check(
    "route runs FTS-independent moduleSearch (always attempted)",
    () => {
      const r = read("apps/web/app/api/search/route.ts");
      return /moduleSearch\(/.test(r) && /import[\s\S]*moduleSearch/.test(r);
    },
  );
  await check(
    "route self-heals the tsv (ensureSearchIndexSchema) and retries before degrading",
    () => {
      const r = read("apps/web/app/api/search/route.ts");
      return (
        /ensureSearchIndexSchema\(\)/.test(r) &&
        /degraded/.test(r) &&
        // a 503 ONLY when module search AND FTS both failed — never a blanket 503
        /!moduleOk\s*&&\s*!ftsOk/.test(r)
      );
    },
  );
  await check(
    "client only shows 'Search unavailable' on !r.ok; degraded → soft notice, results still shown",
    () => {
      const c = read("apps/web/lib/use-search.ts");
      const p = read("apps/web/components/search/CommandPalette.tsx");
      return (
        /if\s*\(!r\.ok\)/.test(c) &&
        /Search unavailable/.test(c) &&
        /degraded/.test(c) &&
        /state\.degraded/.test(p)
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP engine/db checks — DATABASE_URL not set");
  } else {
    const {
      prisma,
      moduleSearch,
      hybridSearch,
      countByType,
      ensureSearchIndexSchema,
    } = await import("@axona/db");
    const org = await prisma.org.findFirst({
      where: { name: "Axona" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const orgId = org.id;
      const hasProcurement = (hits: { type: string; title: string }[]) =>
        hits.some((h) => h.type === "MODULE" && /Procurement/i.test(h.title));

      await check(
        "moduleSearch: 'pro' surfaces Procurement (prefix match, tsv intact)",
        async () => {
          // "pro" is a prefix of both Projects and Procurement — both are valid
          // module hits; the requirement is that Procurement is surfaced.
          const hits = await moduleSearch(orgId, "pro", {
            scope: "ALL",
            limit: 10,
          });
          return hasProcurement(hits);
        },
      );
      await check(
        "moduleSearch: garbage → no results (a real no-match, not a throw)",
        async () => {
          const hits = await moduleSearch(orgId, "zzqxwvplmk", {
            scope: "ALL",
          });
          return hits.length === 0;
        },
      );
      await check(
        "moduleSearch respects scope (AGENT scope → no module rows)",
        async () => {
          const hits = await moduleSearch(orgId, "pro", { scope: "AGENT" });
          return hits.length === 0;
        },
      );

      // THE proof: drop tsv (as a schema op would) → FTS throws, but moduleSearch
      // STILL returns Procurement (FTS-independence). Then self-heal + confirm.
      // Note "pro" is deliberately used for moduleSearch (prefix match works) but
      // the FTS-heal is checked with "procur" — FTS stems "pro" to nothing, which
      // is EXACTLY why module search cannot depend on it. Always restore tsv.
      try {
        await check(
          "DROP tsv → moduleSearch STILL returns Procurement (FTS-independent); FTS throws; self-heal repairs FTS",
          async () => {
            await prisma.$executeRawUnsafe(
              `ALTER TABLE "SearchDoc" DROP COLUMN IF EXISTS "tsv" CASCADE`,
            );

            // module search does not depend on tsv → still works
            const mHits = await moduleSearch(orgId, "pro", {
              scope: "ALL",
              limit: 10,
            });
            const moduleStillWorks = hasProcurement(mHits);

            // FTS is down while tsv is missing (this is the 500 the route catches)
            let ftsThrew = false;
            try {
              await hybridSearch(orgId, "procur", { scope: "ALL", limit: 10 });
            } catch {
              ftsThrew = true;
            }

            // self-heal (what the route does on FTS failure) → FTS works again
            await ensureSearchIndexSchema();
            const healed = await hybridSearch(orgId, "procur", {
              scope: "ALL",
              limit: 10,
            });
            const counts = await countByType(orgId, "procur");

            return (
              moduleStillWorks &&
              ftsThrew &&
              hasProcurement(healed.hits) &&
              (counts.ALL ?? 0) > 0
            );
          },
        );
      } finally {
        // self-clean (MIGRATE.1): always restore the tsv, even on assertion failure
        await ensureSearchIndexSchema();
      }
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
