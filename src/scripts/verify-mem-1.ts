/**
 * Verify MEM.1 — operational memory (structured graph + vector). Static checks
 * always run; the recall/ingest checks need the DB + demo seed (gated behind
 * DATABASE_URL so the pre-push hook runs statics).
 * Run: pnpm verify:mem-1
 *
 *   1. MemoryItem + MemoryKind in the schema; MemoryItem in TENANT_MODELS; the
 *      raw-SQL HNSW index is asserted in a trailing …_ensure_raw_sql_ddl migration.
 *   2. ingestMemory is idempotent (2× → same MemoryItem count).
 *   3. Seed produces memory across ≥3 kinds (DECISION/APPROVAL/EXCEPTION/RESOLUTION).
 *   4. recallMemory({subject:NCR-118, query}) surfaces the NCR-114 RESOLUTION
 *      (contained prior) among the top hits, with outcome + provenance, VIA GRAPH
 *      PROXIMITY (not a string match).
 *   5. Hybrid ≠ pure-vector: a subject-anchored recall returns a graph-neighbor
 *      memory a pure-vector query on the text alone misses (graph contributed).
 *   6. Tenant isolation: a second org recalls ZERO of the first org's memory.
 *   7. recallMemoryTool + getBlastRadiusTool are in registry.coreTools; the Axona
 *      system prompt mentions recall.
 *   8. Embedder DI: with no EMBED_API_KEY, getEmbedder() is the FakeEmbedder (CI-green).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DEMO_ORG_ID = "org_axona_demo";
const SECOND_ORG_ID = "org_isolation_test";

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

async function run(): Promise<void> {
  console.log("\nVerifying MEM.1 — operational memory (graph + vector)\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  // ── 1 (static): schema + TENANT_MODELS + trailing ensure-migration HNSW ──
  const schema = read("packages/db/prisma/schema.prisma");
  const client = read("packages/db/src/client.ts");
  await check(
    "MemoryItem model + MemoryKind enum + TENANT_MODELS + subjectType reuses EntityType",
    () => {
      const body = schema.match(/model MemoryItem \{([\s\S]*?)\n\}/)?.[1] ?? "";
      return (
        body.length > 0 &&
        /enum MemoryKind \{/.test(schema) &&
        /subjectType\s+EntityType\?/.test(body) &&
        /@@unique\(\[orgId, sourceType, sourceId\]\)/.test(body) &&
        /"MemoryItem"/.test(client) && // in TENANT_MODELS
        // confidence carried but uncalibrated (seam only) — no calibration FIELD
        // (a comment mentioning "calibrates" is fine; a column is not)
        !/^\s*calibrat\w*\s+\w/im.test(body)
      );
    },
  );
  await check(
    "raw-SQL HNSW (memoryitem_embedding_hnsw) in a trailing …_ensure_raw_sql_ddl migration",
    () => {
      const dir = join(root, "packages/db/prisma/migrations");
      const ensures = existsSync(dir)
        ? readdirSync(dir).filter((m) => /ensure_raw_sql_ddl/.test(m))
        : [];
      // the memory ensure migration must sort AFTER the mem1 table migration
      const tableMig = existsSync(dir)
        ? readdirSync(dir).find((m) => /mem1_memory_item/.test(m))
        : undefined;
      const hit = ensures.find((m) => {
        const sql = read(`packages/db/prisma/migrations/${m}/migration.sql`);
        return (
          /memoryitem_embedding_hnsw/.test(sql) &&
          /vector_cosine_ops/.test(sql) &&
          /vector\(1536\)/.test(sql)
        );
      });
      return !!hit && !!tableMig && hit > tableMig; // trailing (lexicographically after)
    },
  );

  // ── 7 (import, no DB): registry wiring + prompt ──
  const { registry, buildAgentDef } = await import("@axona/agents");
  await check(
    "recallMemoryTool + getBlastRadiusTool in registry.coreTools (wiring-gap fix)",
    () => {
      const names = registry.coreTools.map((t) => t.name);
      return names.includes("recallMemory") && names.includes("getBlastRadius");
    },
  );
  await check(
    "the Axona (core) agent carries recallMemory + its prompt mentions recall",
    () => {
      const def = buildAgentDef({
        moduleKey: "core",
        role: "AXONA",
        description: "x",
      });
      const toolNames = def.tools.map((t) => t.name);
      // no duplicate tool names (readToolsAcrossModules must stay collision-free)
      const dupes = toolNames.length !== new Set(toolNames).size;
      return (
        toolNames.includes("recallMemory") &&
        toolNames.includes("getBlastRadius") &&
        !dupes &&
        /recall/i.test(def.systemPrompt)
      );
    },
  );

  // ── 8 (no DB): Embedder DI ──
  const { getEmbedder, FakeEmbedder } = await import("@axona/db");
  await check(
    "Embedder DI: no EMBED_API_KEY → FakeEmbedder (CI-green offline)",
    () => {
      const saved = process.env.EMBED_API_KEY;
      delete process.env.EMBED_API_KEY;
      const isFake = getEmbedder() instanceof FakeEmbedder;
      if (saved !== undefined) process.env.EMBED_API_KEY = saved;
      return isFake;
    },
  );

  // ── 2–6 (DB) ──
  if (!process.env.DATABASE_URL) {
    console.log("  SKIP data checks — DATABASE_URL not set");
    console.log(`\nPASSED — ${passed} checks (static only)`);
    return;
  }

  const { dbForOrg, ingestMemory, recallMemory } = await import("@axona/db");
  const db = dbForOrg(DEMO_ORG_ID);

  await check(
    "ingestMemory is idempotent (2× → same MemoryItem count)",
    async () => {
      // Catch up first: earlier verify scripts in the same verify:all run may have
      // appended AuditLog rows this org hasn't ingested yet, so a plain first-call
      // isn't necessarily a no-op. Idempotence = the SECOND consecutive run adds
      // nothing (the @@unique holds), independent of substrate drift.
      await ingestMemory(db);
      const before = await db.memoryItem.count();
      await ingestMemory(db);
      const after = await db.memoryItem.count();
      return before > 0 && before === after;
    },
  );

  await check("seed memory spans ≥3 kinds", async () => {
    const rows = await db.memoryItem.groupBy({
      by: ["kind"],
      _count: { _all: true },
    });
    return rows.length >= 3;
  });

  const ncr118 = await db.nCR.findFirst({
    where: { code: "NCR-118" },
    select: { id: true },
  });
  const ncr118Id = ncr118?.id ?? "";
  const subjectRecall = await recallMemory(db, {
    subjectType: "NCR",
    subjectId: ncr118Id,
    query:
      "drive torque over UCL stiff actuator — have we handled this before?",
    limit: 6,
  });

  await check(
    "recall(NCR-118) surfaces the NCR-114 RESOLUTION (outcome + provenance) via graph proximity",
    () => {
      const h = subjectRecall.find(
        (x) => x.subject?.code === "NCR-114" && x.kind === "RESOLUTION",
      );
      return (
        !!h &&
        h.outcome === "CONTAINED" &&
        h.via.graph === true &&
        (h.via.graphDepth ?? 0) >= 1 &&
        h.provenance.sourceType === "NCR" &&
        /#resolution$/.test(h.provenance.sourceId)
      );
    },
  );

  await check(
    "hybrid ≠ pure-vector: a graph-neighbor memory surfaces that a pure-vector query misses",
    async () => {
      const pureVec = await recallMemory(db, {
        query: "drive torque over UCL stiff actuator",
        limit: 5,
      });
      const pureIds = new Set(pureVec.map((h) => h.provenance.sourceId));
      // the NCR-114 precedent came via graph, not vector, and isn't in pure-vector top-5
      const graphOnly = subjectRecall.filter(
        (h) =>
          h.via.graph &&
          !h.via.vector &&
          (h.via.graphDepth ?? 0) >= 1 &&
          !pureIds.has(h.provenance.sourceId),
      );
      return graphOnly.some((h) => h.subject?.code === "NCR-114");
    },
  );

  await check(
    "tenant isolation: a second org recalls ZERO of the first org's memory",
    async () => {
      const second = await recallMemory(dbForOrg(SECOND_ORG_ID), {
        subjectType: "NCR",
        subjectId: ncr118Id,
        query: "drive torque stiff actuator",
        limit: 5,
      });
      return second.length === 0;
    },
  );

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run().then(() => process.exit(failed > 0 ? 1 : 0));
