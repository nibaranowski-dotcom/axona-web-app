/**
 * Verify FND.5 — Prisma Core/tenancy schema (build-spec §3.1).
 *
 * Run: `pnpm verify:fnd-5`
 *   1. schema.prisma defines Org, User, Module + Role/ModuleGroup enums with
 *      the right fields; User carries orgId (relation) + @@index([orgId]).
 *   2. generator keeps the pgvector-enabled datasource (postgresqlExtensions).
 *   3. `prisma validate` passes and `prisma generate` succeeds.
 * Does NOT run a migration against a live DB (that is FND.11).
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
  console.error(`FND.5 verify FAILED — missing ${SCHEMA_REL}`);
  process.exit(1);
}
const schema = readFileSync(schemaPath, "utf8");

// Extract a top-level `model X { ... }` / `enum X { ... }` body.
function block(kind: "model" | "enum", name: string): string | null {
  const re = new RegExp(`${kind}\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`, "m");
  const m = schema.match(re);
  return m ? (m[1] ?? "") : null;
}
const has = (b: string | null, needle: RegExp | string): boolean =>
  b != null &&
  (typeof needle === "string" ? b.includes(needle) : needle.test(b));

// --- 1/2. datasource + generator --------------------------------------------
if (!/previewFeatures\s*=\s*\[[^\]]*"postgresqlExtensions"/.test(schema)) {
  fail('generator must enable previewFeatures = ["postgresqlExtensions"]');
}
if (!/extensions\s*=\s*\[[^\]]*pgvector/.test(schema)) {
  fail("datasource must keep the pgvector extension");
}
if (!/provider\s*=\s*"postgresql"/.test(schema))
  fail("datasource must be postgresql");

// --- Org ---------------------------------------------------------------------
const org = block("model", "Org");
if (!org) fail("model Org missing");
if (!has(org, /id\s+String\s+@id\s+@default\(cuid\(\)\)/))
  fail("Org.id must be cuid @id");
if (!has(org, /name\s+String/)) fail("Org.name missing");
if (!has(org, /users\s+User\[\]/)) fail("Org.users User[] relation missing");
if (!has(org, /createdAt\s+DateTime\s+@default\(now\(\)\)/))
  fail("Org.createdAt missing");

// --- User (tenant-owned: orgId relation + index) -----------------------------
const user = block("model", "User");
if (!user) fail("model User missing");
if (!has(user, /orgId\s+String/)) fail("User.orgId missing");
if (
  !has(
    user,
    /org\s+Org\s+@relation\(fields:\s*\[orgId\],\s*references:\s*\[id\]\)/,
  )
) {
  fail("User.org relation on orgId missing");
}
if (!has(user, /email\s+String\s+@unique/)) fail("User.email must be @unique");
if (!has(user, /role\s+Role/)) fail("User.role Role missing");
if (!has(user, /@@index\(\[orgId\]\)/)) fail("User must have @@index([orgId])");

// --- Module (global catalog: no orgId) ---------------------------------------
const mod = block("model", "Module");
if (!mod) fail("model Module missing");
if (!has(mod, /key\s+String\s+@unique/)) fail("Module.key must be @unique");
if (!has(mod, /group\s+ModuleGroup/)) fail("Module.group ModuleGroup missing");
if (!has(mod, /orderIndex\s+Int/)) fail("Module.orderIndex Int missing");
if (has(mod, /orgId/))
  fail("Module is a global catalog and must NOT carry orgId");

// --- enums -------------------------------------------------------------------
const role = block("enum", "Role");
for (const v of [
  "ADMIN",
  "OPS",
  "ENGINEER",
  "SALES",
  "FINANCE",
  "TECH",
  "VIEWER",
]) {
  if (!has(role, new RegExp(`\\b${v}\\b`))) fail(`Role enum missing ${v}`);
}
const group = block("enum", "ModuleGroup");
for (const v of ["CORE", "VALUE_CHAIN", "ROBOTICS", "BACK_OFFICE"]) {
  if (!has(group, new RegExp(`\\b${v}\\b`)))
    fail(`ModuleGroup enum missing ${v}`);
}

// --- 3. prisma validate + generate (no DB connection needed) -----------------
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
  console.error(`FND.5 verify FAILED — ${errors.length} issue(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  "FND.5 verify OK — Org/User/Module + Role/ModuleGroup with orgId index; schema valid; client generated.",
);
