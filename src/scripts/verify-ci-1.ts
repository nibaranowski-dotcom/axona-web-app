/**
 * Verify CI.1 — CI is a real gate. Run: pnpm verify:ci-1
 *
 * Before CI.1 the `verify` job ran `pnpm verify:all` with NO `DATABASE_URL`, so every
 * DB-gated check skipped itself: 868 assertions executed, 122 blocks skipped, and
 * "CI green" was never evidence for any database-backed behaviour (it is how the
 * VERIFY.3 flakes survived — they could only ever fail locally).
 *
 * These are static checks over the workflow. The behavioural proof is a CI run where
 * the DB-gated checks execute, plus a deliberately-broken DB assertion turning CI red
 * (see docs/manual-checks.md → CI.1).
 *
 * The invariants that must not rot:
 *   1. The verify job HAS a database, and it is pgvector-capable — the committed
 *      migrations carry raw SQL (`vector(1536)` + HNSW, FTS `tsv` + GIN) that plain
 *      `postgres:*` cannot execute.
 *   2. Schema comes from `prisma migrate deploy`, NEVER `db push` (MIGRATE.1), and
 *      `migrate status` gates on drift.
 *   3. The data the checks read is really there: seed (+ the blob backfill, or the
 *      FILE.* live checks silently go back to skipping).
 *   4. `verify:all` runs AFTER all of that, in the same job, so it sees the DB.
 *   5. No secrets: CI credentials are ephemeral service-container values.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;
const check = (label: string, fn: () => boolean): void => {
  try {
    const ok = fn();
    console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
    ok ? passed++ : failed++;
  } catch (e) {
    console.log(`  FAIL ${label} — ${(e as Error).message}`);
    failed++;
  }
};

const ROOT = process.cwd();
const read = (p: string): string =>
  existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), "utf8") : "";

function run(): void {
  console.log(
    "\nVerifying CI.1 — CI runs verify:all against a real database\n",
  );

  const ci = read(".github/workflows/ci.yml");
  check("ci.yml exists", () => ci.length > 0);

  // The `verify` job block: from its header to the next top-level job.
  const start = ci.indexOf("  verify:");
  const nextJob = /\n {2}[a-z0-9_-]+:\n {4}runs-on:/.exec(ci.slice(start + 10));
  const job =
    start >= 0
      ? ci.slice(start, nextJob ? start + 10 + nextJob.index : undefined)
      : "";
  check("the verify job block is parseable", () => job.length > 0);

  // Assert what CI EXECUTES, not what the comments say: strip `#` comment lines
  // (they legitimately mention `db push` and `migrate deploy` while explaining why).
  const exec = job
    .split("\n")
    .filter((l) => !/^\s*#/.test(l))
    .join("\n");
  const stepIndex = (needle: string): number => exec.indexOf(needle);

  check(
    "1. the verify job sets DATABASE_URL (checks EXECUTE, not skip)",
    () => {
      return /DATABASE_URL:\s*postgresql:\/\//.test(job);
    },
  );

  check(
    "1b. Postgres is pgvector-capable (plain postgres fails the DDL)",
    () => {
      return /image:\s*pgvector\/pgvector:pg\d+/.test(job);
    },
  );

  check("1c. the blob store is wired so FILE.* live checks run", () => {
    return (
      /S3_ENDPOINT:/.test(job) &&
      /S3_BUCKET:/.test(job) &&
      /minio\/minio:latest server \/data/.test(job) &&
      /minio\/health\/live/.test(job) // waits for readiness, no bare sleep
    );
  });

  check("2. schema via `migrate deploy` — never `db push` (MIGRATE.1)", () => {
    return (
      /prisma migrate deploy/.test(exec) &&
      !/db\s+push/.test(exec) &&
      !/db:push/.test(exec)
    );
  });

  check(
    "2b. `migrate status` gates the job on drift/pending migrations",
    () => {
      return /prisma migrate status/.test(exec);
    },
  );

  check("3. the data is seeded (narrative + blob backfill)", () => {
    return /db:seed\b/.test(exec) && /db:seed:blobs/.test(exec);
  });

  check("4. verify:all runs AFTER migrate → status → seed → blobs", () => {
    const deploy = stepIndex("prisma migrate deploy");
    const status = stepIndex("prisma migrate status");
    const seed = stepIndex("db:seed\n");
    const blobs = stepIndex("db:seed:blobs");
    const verify = stepIndex("pnpm verify:all");
    return (
      deploy > 0 &&
      status > deploy &&
      seed > status &&
      blobs > seed &&
      verify > blobs
    );
  });

  check("4b. lint · typecheck · build are still gated", () => {
    return (
      /run:\s*pnpm lint/.test(job) &&
      /run:\s*pnpm typecheck/.test(job) &&
      /pnpm --filter @axona\/web build/.test(job)
    );
  });

  check("4c. `pnpm eval` still runs against a seeded DB (its own job)", () => {
    // EVAL.1's gate is a separate job with the same pgvector service — not
    // duplicated into `verify`, where verify:eval-1 already exercises it.
    const evalJob = ci.slice(ci.indexOf("\n  eval:"));
    return (
      /pnpm eval/.test(evalJob) &&
      /prisma migrate deploy/.test(evalJob) &&
      /db:seed/.test(evalJob) &&
      /image:\s*pgvector\/pgvector:pg\d+/.test(evalJob)
    );
  });

  check(
    "5. no committed secrets — CI creds are ephemeral service values",
    () => {
      // Every credential in the workflow must be a literal that matches the service
      // container it talks to (or a documented dummy), never a token/${{ secrets.* }}.
      const suspicious =
        /(sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{16,}|AKIA[A-Z0-9]{12,}|-----BEGIN [A-Z ]*PRIVATE KEY)/.test(
          ci,
        );
      return !suspicious && /ci-dummy-secret/.test(ci);
    },
  );

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run();
