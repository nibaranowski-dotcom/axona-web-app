/**
 * Verify SRCH.4 — universal search bugfix. Static resilience checks always run;
 * the engine checks are gated on DATABASE_URL. Run: pnpm verify:srch-4
 *
 * Root cause: `prisma db push` (the push-managed dev DB has no migration history)
 * dropped the raw-SQL `tsv` column, so `search()` threw and `/api/search` 500'd —
 * which the route surfaced as an unhandled 500 and the client masked as
 * "Search unavailable" (even for legitimate no-matches). Fix: self-heal the FTS
 * objects on reindex; return a clean JSON 503 on failure; the client checks r.ok.
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
  console.log("\nVerifying SRCH.4 — universal search bugfix\n");

  // --- static resilience ---
  await check(
    "route returns a clean JSON 503 on failure (not an unhandled 500)",
    () => {
      const r = read("apps/web/app/api/search/route.ts");
      return (
        /try\s*{/.test(r) &&
        /catch/.test(r) &&
        /status:\s*503/.test(r) &&
        /error:\s*"search_failed"/.test(r) &&
        /console\.error/.test(r)
      );
    },
  );
  await check(
    "client checks r.ok — 5xx → unavailable, 200-empty → no-match",
    () => {
      const c = read("apps/web/lib/use-search.ts");
      return (
        /if\s*\(!r\.ok\)/.test(c) &&
        /Search unavailable/.test(c) &&
        // the no-match empty state lives in the palette, not masked as an error
        // SRCH.4 (palette) renders the design's UPPERCASE "NO MATCHES FOR …";
        // the property guarded here is that the no-match state lives in the
        // palette rather than being masked as an error, so match either casing.
        /No matches/i.test(
          read("apps/web/components/search/CommandPalette.tsx"),
        )
      );
    },
  );
  await check(
    "reindex self-heals the FTS objects (ensureSearchIndexSchema)",
    () => {
      const r = read("packages/db/src/search/reindex.ts");
      return (
        /export async function ensureSearchIndexSchema/.test(r) &&
        /ADD COLUMN IF NOT EXISTS "tsv"/.test(r) &&
        /CREATE INDEX IF NOT EXISTS "searchdoc_tsv_gin"/.test(r) &&
        /await ensureSearchIndexSchema\(\)/.test(r)
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP engine/db checks — DATABASE_URL not set");
  } else {
    const { prisma, search, countByType, ensureSearchIndexSchema } =
      await import("@axona/db");
    const org = await prisma.org.findFirst({
      where: { name: "Axona" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const orgId = org.id;
      const hasProcurementModule = (hits: { type: string; title: string }[]) =>
        hits.some((h) => h.type === "MODULE" && /Procurement/i.test(h.title));

      await check(
        "modules indexed: procur → Procurement MODULE hit (near top)",
        async () => {
          const { hits } = await search(orgId, "procur", {
            scope: "ALL",
            limit: 10,
          });
          const idx = hits.findIndex(
            (h) => h.type === "MODULE" && /Procurement/i.test(h.title),
          );
          return idx >= 0 && idx <= 3 && hits.length > 0;
        },
      );
      await check(
        "more module names resolve (sales → Sales & CRM, fleet → Fleet)",
        async () => {
          const sales = await search(orgId, "sales", {
            scope: "MODULE",
            limit: 5,
          });
          const fleet = await search(orgId, "fleet", {
            scope: "MODULE",
            limit: 5,
          });
          return (
            sales.hits.some(
              (h) => h.type === "MODULE" && /Sales/i.test(h.title),
            ) &&
            fleet.hits.some(
              (h) => h.type === "MODULE" && /Fleet/i.test(h.title),
            )
          );
        },
      );
      await check(
        "garbage query → empty result (no throw; a real no-match)",
        async () => {
          const { hits } = await search(orgId, "zzqxwvplmk", { scope: "ALL" });
          const c = await countByType(orgId, "zzqxwvplmk");
          return hits.length === 0 && c.ALL === 0;
        },
      );
      await check("counts populate per type for a real query", async () => {
        const c = await countByType(orgId, "procur");
        return (
          (c.ALL ?? 0) > 0 &&
          (c.MODULE ?? 0) >= 1 &&
          typeof c.AGENT === "number" &&
          "PROJECT" in c
        );
      });

      // The root-cause self-heal: drop `tsv` (as a `db push` would), confirm
      // search throws (the 500), then ensureSearchIndexSchema repairs it.
      await check(
        "self-heal: drop tsv → search throws → ensure repairs it",
        async () => {
          await prisma.$executeRawUnsafe(
            `ALTER TABLE "SearchDoc" DROP COLUMN IF EXISTS "tsv" CASCADE`,
          );
          let threw = false;
          try {
            await search(orgId, "procur", { scope: "ALL" });
          } catch {
            threw = true;
          }
          await ensureSearchIndexSchema();
          const { hits } = await search(orgId, "procur", {
            scope: "ALL",
            limit: 10,
          });
          return threw && hasProcurementModule(hits);
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
