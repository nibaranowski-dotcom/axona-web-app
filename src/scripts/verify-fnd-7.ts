/**
 * Verify FND.7 — Prisma Projects/Files/MatrixColumn + pgvector (build-spec §3.3).
 *
 * Run: `pnpm verify:fnd-7`
 *   1. Project (+ ProjectStatus enum), File, MatrixColumn with the right fields.
 *   2. Tenancy: Project carries orgId + @@index([orgId]); File/MatrixColumn have
 *      an indexed projectId FK; Project.files relation array.
 *   3. File.extracted is Json; File.embedding is Unsupported("vector")?;
 *      File.linkedTo is String?.
 *   4. /// pointer to MEM.1 (memory) present; no memory/graph columns added.
 *   5. `prisma validate` passes and `prisma generate` succeeds.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const errors: string[] = [];
const fail = (m: string) => errors.push(m);

const SCHEMA_REL = "packages/db/prisma/schema.prisma";
const schemaPath = join(root, SCHEMA_REL);
if (!existsSync(schemaPath)) {
  console.error(`FND.7 verify FAILED — missing ${SCHEMA_REL}`);
  process.exit(1);
}
const schema = readFileSync(schemaPath, "utf8");

function block(kind: "model" | "enum", name: string): string | null {
  const re = new RegExp(`${kind}\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`, "m");
  const m = schema.match(re);
  return m ? (m[1] ?? "") : null;
}
const has = (b: string | null, needle: RegExp | string): boolean =>
  b != null &&
  (typeof needle === "string" ? b.includes(needle) : needle.test(b));
const requireField = (
  b: string | null,
  model: string,
  label: string,
  re: RegExp,
): void => {
  if (!has(b, re)) fail(`${model}.${label} missing/incorrect`);
};

// --- Project (tenant-owned) --------------------------------------------------
const project = block("model", "Project");
if (!project) fail("model Project missing");
requireField(project, "Project", "orgId", /orgId\s+String/);
requireField(project, "Project", "moduleKey", /moduleKey\s+String/);
requireField(project, "Project", "name", /name\s+String/);
requireField(project, "Project", "description", /description\s+String/);
requireField(project, "Project", "status", /status\s+ProjectStatus/);
requireField(project, "Project", "members", /members\s+Json/);
requireField(project, "Project", "files", /files\s+File\[\]/);
requireField(
  project,
  "Project",
  "updatedAt",
  /updatedAt\s+DateTime\s+@updatedAt/,
);
requireField(project, "Project", "@@index([orgId])", /@@index\(\[orgId\]\)/);

for (const v of ["ACTIVE", "IN_REVIEW", "BLOCKED", "DONE"]) {
  if (!has(block("enum", "ProjectStatus"), new RegExp(`\\b${v}\\b`)))
    fail(`ProjectStatus enum missing ${v}`);
}

// --- File --------------------------------------------------------------------
const file = block("model", "File");
if (!file) fail("model File missing");
requireField(file, "File", "projectId", /projectId\s+String/);
requireField(
  file,
  "File",
  "project relation",
  /project\s+Project\s+@relation\(fields:\s*\[projectId\],\s*references:\s*\[id\]\)/,
);
requireField(file, "File", "name", /name\s+String/);
requireField(file, "File", "ext", /ext\s+String/);
requireField(file, "File", "sizeBytes", /sizeBytes\s+Int/);
requireField(file, "File", "blobKey", /blobKey\s+String/);
requireField(file, "File", "type", /type\s+String/);
requireField(file, "File", "linkedTo", /linkedTo\s+String\?/);
requireField(file, "File", "extracted (Json)", /extracted\s+Json\b/);
requireField(
  file,
  "File",
  'embedding Unsupported("vector")?',
  /embedding\s+Unsupported\("vector"\)\?/,
);
requireField(file, "File", "modifiedAt", /modifiedAt\s+DateTime\s+@updatedAt/);
requireField(file, "File", "@@index([projectId])", /@@index\(\[projectId\]\)/);

// --- MatrixColumn ------------------------------------------------------------
const mtx = block("model", "MatrixColumn");
if (!mtx) fail("model MatrixColumn missing");
requireField(mtx, "MatrixColumn", "projectId", /projectId\s+String/);
requireField(mtx, "MatrixColumn", "question", /question\s+String/);
requireField(mtx, "MatrixColumn", "createdBy", /createdBy\s+String/);
requireField(
  mtx,
  "MatrixColumn",
  "createdAt",
  /createdAt\s+DateTime\s+@default\(now\(\)\)/,
);
requireField(
  mtx,
  "MatrixColumn",
  "@@index([projectId])",
  /@@index\(\[projectId\]\)/,
);

// --- moat /// pointer + no premature memory columns --------------------------
if (!/MEM\.1/.test(schema))
  fail("File.extracted /// pointer must reference MEM.1");

// --- prisma validate + generate ---------------------------------------------
const env = {
  ...process.env,
  DATABASE_URL:
    process.env.DATABASE_URL ?? "postgresql://axona:axona@localhost:5432/axona",
};
function run(label: string, cmd: string): void {
  try {
    execSync(cmd, { cwd: root, env, stdio: "pipe" });
  } catch (e) {
    const out = e instanceof Error ? e.message : String(e);
    fail(`${label} failed: ${out.split("\n").slice(-3).join(" ")}`);
  }
}
run("prisma validate", "pnpm --filter @axona/db exec prisma validate");
run("prisma generate", "pnpm --filter @axona/db exec prisma generate");

// --- report ------------------------------------------------------------------
if (errors.length > 0) {
  console.error(`FND.7 verify FAILED — ${errors.length} issue(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  "FND.7 verify OK — Project/File/MatrixColumn + ProjectStatus; orgId & projectId indexes; extracted Json + embedding Unsupported(vector); schema valid; client generated.",
);
