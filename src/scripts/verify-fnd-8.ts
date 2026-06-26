/**
 * Verify FND.8 — Prisma Machines + MachineSignal time-series (build-spec §3.4).
 *
 * Run: `pnpm verify:fnd-8`
 *   1. Machine (+ MachineKind/MachineStatus/HealthLevel enums) and MachineSignal
 *      with the right fields.
 *   2. Tenancy: Machine carries orgId + @@index([orgId]); MachineSignal has an
 *      indexed FK to machineId via the composite time-series index.
 *   3. MachineSignal has the composite @@index([machineId, ts]).
 *   4. /// pointer to TEL.1 (+ MEM.1) present.
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
  console.error(`FND.8 verify FAILED — missing ${SCHEMA_REL}`);
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

// --- Machine (tenant-owned) --------------------------------------------------
const machine = block("model", "Machine");
if (!machine) fail("model Machine missing");
requireField(machine, "Machine", "orgId", /orgId\s+String/);
requireField(machine, "Machine", "assetId", /assetId\s+String/);
requireField(machine, "Machine", "name", /name\s+String/);
requireField(machine, "Machine", "kind", /kind\s+MachineKind/);
requireField(machine, "Machine", "category", /category\s+String/);
requireField(machine, "Machine", "location", /location\s+String/);
requireField(machine, "Machine", "status", /status\s+MachineStatus/);
requireField(machine, "Machine", "utilization", /utilization\s+Int/);
requireField(machine, "Machine", "health", /health\s+String/);
requireField(machine, "Machine", "healthLevel", /healthLevel\s+HealthLevel/);
requireField(
  machine,
  "Machine",
  "telemetryOnline",
  /telemetryOnline\s+Boolean/,
);
requireField(machine, "Machine", "signals", /signals\s+MachineSignal\[\]/);
requireField(machine, "Machine", "@@index([orgId])", /@@index\(\[orgId\]\)/);

// --- enums -------------------------------------------------------------------
for (const v of ["FIXED", "MOBILE"]) {
  if (!has(block("enum", "MachineKind"), new RegExp(`\\b${v}\\b`)))
    fail(`MachineKind enum missing ${v}`);
}
for (const v of ["RUNNING", "IDLE", "MAINTENANCE", "CHARGING", "FAULT"]) {
  if (!has(block("enum", "MachineStatus"), new RegExp(`\\b${v}\\b`)))
    fail(`MachineStatus enum missing ${v}`);
}
for (const v of ["OK", "WATCH", "BAD"]) {
  if (!has(block("enum", "HealthLevel"), new RegExp(`\\b${v}\\b`)))
    fail(`HealthLevel enum missing ${v}`);
}

// --- MachineSignal (time-series child) --------------------------------------
const signal = block("model", "MachineSignal");
if (!signal) fail("model MachineSignal missing");
requireField(signal, "MachineSignal", "machineId", /machineId\s+String/);
requireField(
  signal,
  "MachineSignal",
  "machine relation",
  /machine\s+Machine\s+@relation\(fields:\s*\[machineId\],\s*references:\s*\[id\]\)/,
);
requireField(signal, "MachineSignal", "ts", /ts\s+DateTime/);
requireField(signal, "MachineSignal", "metric", /metric\s+String/);
requireField(signal, "MachineSignal", "value", /value\s+Float/);
requireField(
  signal,
  "MachineSignal",
  "composite @@index([machineId, ts])",
  /@@index\(\[machineId,\s*ts\]\)/,
);

// --- moat /// pointer --------------------------------------------------------
if (!/TEL\.1/.test(schema)) {
  fail("MachineSignal /// pointer must reference TEL.1 (telemetry)");
}

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
  console.error(`FND.8 verify FAILED — ${errors.length} issue(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  "FND.8 verify OK — Machine + MachineKind/MachineStatus/HealthLevel + MachineSignal; orgId index + composite [machineId, ts]; TEL.1 pointer; schema valid; client generated.",
);
