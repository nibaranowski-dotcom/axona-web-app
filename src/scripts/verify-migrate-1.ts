/**
 * Verify MIGRATE.1 — migration history is the canonical, drift-proof schema path.
 * Static checks always run; DB checks are gated on DATABASE_URL. Run:
 *   pnpm verify:migrate-1
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
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
const read = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");
const migrationsDir = join(root, "packages/db/prisma/migrations");

function allMigrationSql(): string {
  return readdirSync(migrationsDir)
    .filter((d) => existsSync(join(migrationsDir, d, "migration.sql")))
    .map((d) => read(join(migrationsDir, d, "migration.sql")))
    .join("\n");
}

async function run(): Promise<void> {
  console.log("\nVerifying MIGRATE.1 — canonical, drift-proof migrations\n");

  const sql = allMigrationSql();

  await check(
    "FTS DDL lives in committed migrations (tsv column + GIN index)",
    () => {
      return (
        /ADD COLUMN[^;]*"tsv" tsvector/i.test(sql) &&
        /"searchdoc_tsv_gin"/.test(sql) &&
        /gin \("tsv"\)/.test(sql)
      );
    },
  );
  await check(
    "pgvector DDL in migrations (File + SearchDoc vector + HNSW)",
    () => {
      return (
        /ALTER TABLE "File"[\s\S]*vector\(1536\)/.test(sql) &&
        /"file_embedding_hnsw"/.test(sql) &&
        /"searchdoc_embedding_hnsw"/.test(sql) &&
        /USING hnsw/.test(sql)
      );
    },
  );
  await check(
    "a trailing ensure-migration re-asserts every raw-SQL object",
    () => {
      const dirs = readdirSync(migrationsDir).filter((d) => /migrate1/.test(d));
      if (dirs.length === 0) return false;
      const s = read(join(migrationsDir, dirs[0]!, "migration.sql"));
      return (
        /IF NOT EXISTS "file_embedding_hnsw"/.test(s) &&
        /IF NOT EXISTS "searchdoc_tsv_gin"/.test(s) &&
        /IF NOT EXISTS "searchdoc_embedding_hnsw"/.test(s) &&
        /ADD COLUMN IF NOT EXISTS "tsv"/.test(s)
      );
    },
  );
  await check(
    "no `prisma db push` in scripts / dev.sh / CI (migrate is the only path)",
    () => {
      const files = [
        "package.json",
        "packages/db/package.json",
        "apps/web/package.json",
        "apps/worker/package.json",
        "dev.sh",
        ".github/workflows/ci.yml",
      ];
      return files.every((f) => !/db\s+push|db:push/.test(read(join(root, f))));
    },
  );
  await check(
    "verify-wf-1 self-cleans (snapshots seeded runs, deletes the rest)",
    () => {
      const v = read(join(root, "src/scripts/verify-wf-1.ts"));
      return (
        /seededRunIds/.test(v) &&
        /notIn: \[\.\.\.seededRunIds\]/.test(v) &&
        /workflowRun\.deleteMany/.test(v)
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP db checks — DATABASE_URL not set");
  } else {
    const { prisma, search } = await import("@axona/db");

    await check(
      "migration history clean (every on-disk migration applied, none rolled back)",
      async () => {
        const onDisk = readdirSync(migrationsDir).filter((d) =>
          existsSync(join(migrationsDir, d, "migration.sql")),
        );
        const rows = (await prisma.$queryRawUnsafe(
          `select migration_name, finished_at is not null as done, rolled_back_at is not null as rb from _prisma_migrations`,
        )) as { migration_name: string; done: boolean; rb: boolean }[];
        const applied = new Set(
          rows.filter((r) => r.done && !r.rb).map((r) => r.migration_name),
        );
        const anyRolledBack = rows.some((r) => r.rb);
        return !anyRolledBack && onDisk.every((d) => applied.has(d));
      },
    );

    await check(
      "(a) SearchDoc.tsv present + FTS query returns a Module hit",
      async () => {
        const col = (await prisma.$queryRawUnsafe(
          `select 1 from information_schema.columns where table_name=$1 and column_name=$2`,
          "SearchDoc",
          "tsv",
        )) as unknown[];
        const org = await prisma.org.findFirst({
          where: { name: "Axona" },
        });
        if (!org || col.length === 0) return false;
        const { hits } = await search(org.id, "procur", {
          scope: "ALL",
          limit: 5,
        });
        return hits.some(
          (h) => h.type === "MODULE" && /Procurement/i.test(h.title),
        );
      },
    );

    await check(
      "(b) File.embedding vector(1536) + HNSW ANN index present",
      async () => {
        const type = (await prisma.$queryRawUnsafe(
          `select format_type(a.atttypid,a.atttypmod) t from pg_attribute a join pg_class c on c.oid=a.attrelid where c.relname=$1 and a.attname=$2`,
          "File",
          "embedding",
        )) as { t: string }[];
        const idx = (await prisma.$queryRawUnsafe(
          `select 1 from pg_indexes where indexname=$1`,
          "file_embedding_hnsw",
        )) as unknown[];
        return /vector\(1536\)/.test(type[0]?.t ?? "") && idx.length > 0;
      },
    );

    await check(
      "parked fixture intact — procurement latest run is AWAITING_APPROVAL",
      async () => {
        const org = await prisma.org.findFirst({
          where: { name: "Axona" },
        });
        const proc = await prisma.workflow.findFirst({
          where: { orgId: org!.id, name: "Procurement reorder" },
        });
        const latest = await prisma.workflowRun.findFirst({
          where: { workflowId: proc!.id },
          orderBy: { startedAt: "desc" },
        });
        return latest?.status === "AWAITING_APPROVAL";
      },
    );

    await prisma.$disconnect();
  }

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
