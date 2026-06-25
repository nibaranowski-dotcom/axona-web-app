/**
 * Verify FND.3 — docker-compose dev environment.
 *
 * Run: `pnpm verify:fnd-3`
 * Static checks (Node built-ins only) — does NOT start containers:
 *   1. docker-compose.yml defines postgres + redis + minio.
 *   2. Each of those three has a healthcheck and mounts a named volume.
 *   3. Postgres uses a pgvector-enabled image.
 *   4. A vector-extension init runs on first boot (init SQL + mount).
 *   5. A MinIO bucket-create step exists for S3_BUCKET.
 *   6. .env.example carries the required keys.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const errors: string[] = [];
const fail = (m: string) => errors.push(m);

const read = (rel: string): string => {
  const p = join(root, rel);
  if (!existsSync(p)) {
    fail(`missing file: ${rel}`);
    return "";
  }
  return readFileSync(p, "utf8");
};

const compose = read("docker-compose.yml");

// --- extract a top-level service block from `services:` ----------------------
function serviceBlock(name: string): string {
  const lines = compose.split("\n");
  const start = lines.findIndex((l) => new RegExp(`^  ${name}:\\s*$`).test(l));
  if (start === -1) return "";
  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i] ?? "";
    // stop at the next service (2-space key) or a top-level key (0-indent)
    if (/^  \S/.test(l) || /^\S/.test(l)) break;
    body.push(l);
  }
  return body.join("\n");
}

// 1 + 2. core services, each with healthcheck + a volume mount
for (const svc of ["postgres", "redis", "minio"]) {
  const block = serviceBlock(svc);
  if (!block) {
    fail(`docker-compose.yml: service "${svc}" not defined`);
    continue;
  }
  if (!block.includes("healthcheck:")) fail(`service "${svc}" has no healthcheck`);
  if (!/volumes:/.test(block) || !/-\s+\S+:/.test(block)) {
    fail(`service "${svc}" mounts no volume`);
  }
}

// 3. pgvector image
if (!/image:\s*pgvector\/pgvector/.test(serviceBlock("postgres"))) {
  fail("postgres must use a pgvector image (pgvector/pgvector:pgNN)");
}

// 4. vector extension init (SQL file + entrypoint-initdb mount)
const initDir = "docker/postgres/init";
let hasVectorSql = false;
if (existsSync(join(root, initDir))) {
  for (const f of readdirSync(join(root, initDir))) {
    if (!f.endsWith(".sql")) continue;
    const sql = read(`${initDir}/${f}`);
    if (/create\s+extension[^;]*vector/i.test(sql)) hasVectorSql = true;
  }
}
if (!hasVectorSql) fail(`no "CREATE EXTENSION ... vector" found in ${initDir}/*.sql`);
if (!compose.includes("/docker-entrypoint-initdb.d")) {
  fail("postgres does not mount the init dir into /docker-entrypoint-initdb.d");
}

// 5. MinIO bucket-create step
if (!/mc\s+mb/.test(compose)) {
  fail("no MinIO bucket-create step (expected `mc mb ...` for S3_BUCKET)");
}

// 6. named top-level volumes declared
const volumesSection = compose.slice(compose.lastIndexOf("\nvolumes:"));
for (const v of ["postgres-data", "redis-data", "minio-data"]) {
  if (!volumesSection.includes(`${v}:`)) fail(`top-level volume "${v}" not declared`);
}

// 7. .env.example keys
const env = read(".env.example");
for (const key of [
  "DATABASE_URL",
  "REDIS_URL",
  "S3_ENDPOINT",
  "S3_BUCKET",
  "MINIO_ROOT_USER",
  "MINIO_ROOT_PASSWORD",
]) {
  if (!new RegExp(`^${key}=`, "m").test(env)) fail(`.env.example missing ${key}`);
}

// --- report ------------------------------------------------------------------
if (errors.length > 0) {
  console.error(`FND.3 verify FAILED — ${errors.length} issue(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  "FND.3 verify OK — postgres(pgvector)+redis+minio with healthchecks/volumes, vector init, bucket-create, env keys present.",
);
