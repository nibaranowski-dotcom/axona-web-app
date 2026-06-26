/**
 * Verify FND.10 — Prisma robotics + back-office entities (build-spec §3.6).
 *
 * Run: `pnpm verify:fnd-10`
 *   1. All 18 §3.6 models exist with the right fields/types.
 *   2. Severity is REUSED from §3.5 (defined exactly once), used by
 *      WorkOrderField/SafetyIncident/CVE.
 *   3. Tenancy: every model scalar orgId + @@index([orgId]); FK indexes
 *      (TelemetryPoint.robotId via composite, WorkOrderField.techId) +
 *      read-path indexes ([robotId,ts], [site,ts], [slaDueAt], [hwRev,fwVersion]).
 *   4. Moat /// pointers: TEL.1, MEM.1, ONT.2, RBAC.4, AUDIT.3.
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
  console.error(`FND.10 verify FAILED — missing ${SCHEMA_REL}`);
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
const req = (
  b: string | null,
  model: string,
  label: string,
  re: RegExp,
): void => {
  if (!has(b, re)) fail(`${model}.${label} missing/incorrect`);
};

// --- the 18 §3.6 models, all tenant-owned -----------------------------------
const models = [
  "Robot",
  "TelemetryPoint",
  "WorkOrderField",
  "Technician",
  "ECO",
  "FirmwareRelease",
  "CompatCell",
  "AutonomyMetric",
  "SafetyIncident",
  "PolicyVersion",
  "LedgerEntry",
  "Invoice",
  "UnitEconomic",
  "Requisition",
  "CVE",
  "Obligation",
  "ExportLicense",
  "LegalMatter",
];
for (const name of models) {
  const b = block("model", name);
  if (!b) {
    fail(`model ${name} missing`);
    continue;
  }
  req(b, name, "orgId", /orgId\s+String/);
  req(b, name, "@@index([orgId])", /@@index\(\[orgId\]\)/);
}

// --- field-level checks (types that matter) ----------------------------------
const robot = block("model", "Robot");
req(robot, "Robot", "serial", /serial\s+String/);
req(robot, "Robot", "model", /model\s+String/);
req(robot, "Robot", "customer", /customer\s+String/);
req(robot, "Robot", "site", /site\s+String/);
req(robot, "Robot", "uptimePct", /uptimePct\s+Float/);
req(robot, "Robot", "firmware", /firmware\s+String/);
req(robot, "Robot", "status", /status\s+String/);
req(robot, "Robot", "lat", /lat\s+Float\?/);
req(robot, "Robot", "lng", /lng\s+Float\?/);

const tp = block("model", "TelemetryPoint");
req(tp, "TelemetryPoint", "robotId", /robotId\s+String/);
req(tp, "TelemetryPoint", "ts", /ts\s+DateTime/);
req(tp, "TelemetryPoint", "metric", /metric\s+String/);
req(tp, "TelemetryPoint", "value", /value\s+Float/);
req(
  tp,
  "TelemetryPoint",
  "@@index([robotId, ts])",
  /@@index\(\[robotId,\s*ts\]\)/,
);

const wof = block("model", "WorkOrderField");
req(wof, "WorkOrderField", "code", /code\s+String/);
req(wof, "WorkOrderField", "robotSerial", /robotSerial\s+String/);
req(wof, "WorkOrderField", "site", /site\s+String/);
req(wof, "WorkOrderField", "issue", /issue\s+String/);
req(wof, "WorkOrderField", "slaDueAt", /slaDueAt\s+DateTime\?/);
req(wof, "WorkOrderField", "techId", /techId\s+String\?/);
req(wof, "WorkOrderField", "status", /status\s+String/);
req(wof, "WorkOrderField", "severity", /severity\s+Severity/);
req(wof, "WorkOrderField", "@@index([techId])", /@@index\(\[techId\]\)/);
req(wof, "WorkOrderField", "@@index([slaDueAt])", /@@index\(\[slaDueAt\]\)/);

const tech = block("model", "Technician");
req(tech, "Technician", "initials", /initials\s+String/);
req(tech, "Technician", "site", /site\s+String/);
req(tech, "Technician", "status", /status\s+String/);
req(tech, "Technician", "certs", /certs\s+Json/);

const eco = block("model", "ECO");
req(eco, "ECO", "code", /code\s+String/);
req(eco, "ECO", "title", /title\s+String/);
req(eco, "ECO", "changeType", /changeType\s+String/);
req(eco, "ECO", "affected", /affected\s+String/);
req(eco, "ECO", "stage", /stage\s+String/);

const fw = block("model", "FirmwareRelease");
req(fw, "FirmwareRelease", "version", /version\s+String/);
req(fw, "FirmwareRelease", "note", /note\s+String/);
req(fw, "FirmwareRelease", "state", /state\s+String/);

const cc = block("model", "CompatCell");
req(cc, "CompatCell", "hwRev", /hwRev\s+String/);
req(cc, "CompatCell", "fwVersion", /fwVersion\s+String/);
req(cc, "CompatCell", "state", /state\s+String/);
req(
  cc,
  "CompatCell",
  "@@index([hwRev, fwVersion])",
  /@@index\(\[hwRev,\s*fwVersion\]\)/,
);

const am = block("model", "AutonomyMetric");
req(am, "AutonomyMetric", "site", /site\s+String/);
req(am, "AutonomyMetric", "ts", /ts\s+DateTime/);
req(am, "AutonomyMetric", "autonomyRate", /autonomyRate\s+Float/);
req(am, "AutonomyMetric", "takeoversPer1k", /takeoversPer1k\s+Float/);
req(am, "AutonomyMetric", "policyVersion", /policyVersion\s+String/);
req(am, "AutonomyMetric", "@@index([site, ts])", /@@index\(\[site,\s*ts\]\)/);

const si = block("model", "SafetyIncident");
req(si, "SafetyIncident", "code", /code\s+String/);
req(si, "SafetyIncident", "type", /type\s+String/);
req(si, "SafetyIncident", "robotSerial", /robotSerial\s+String/);
req(si, "SafetyIncident", "severity", /severity\s+Severity/);

const pv = block("model", "PolicyVersion");
req(pv, "PolicyVersion", "version", /version\s+String/);
req(pv, "PolicyVersion", "state", /state\s+String/);

const ledger = block("model", "LedgerEntry");
req(ledger, "LedgerEntry", "period", /period\s+String/);
req(ledger, "LedgerEntry", "account", /account\s+String/);
req(ledger, "LedgerEntry", "amount", /amount\s+Float/);
req(ledger, "LedgerEntry", "kind", /kind\s+String/);

const inv = block("model", "Invoice");
req(inv, "Invoice", "code", /code\s+String/);
req(inv, "Invoice", "source", /source\s+String/);
req(inv, "Invoice", "amount", /amount\s+Float/);
req(inv, "Invoice", "terms", /terms\s+String/);
req(inv, "Invoice", "dueDate", /dueDate\s+DateTime\?/);
req(inv, "Invoice", "status", /status\s+String/);

const ue = block("model", "UnitEconomic");
req(ue, "UnitEconomic", "product", /product\s+String/);
req(ue, "UnitEconomic", "asp", /asp\s+Float/);
req(ue, "UnitEconomic", "cogs", /cogs\s+Float/);
req(ue, "UnitEconomic", "marginPct", /marginPct\s+Float/);
req(ue, "UnitEconomic", "trend", /trend\s+String/);

const reqn = block("model", "Requisition");
req(reqn, "Requisition", "role", /role\s+String/);
req(reqn, "Requisition", "filled", /filled\s+Int/);
req(reqn, "Requisition", "target", /target\s+Int/);

const cve = block("model", "CVE");
req(cve, "CVE", "code", /code\s+String/);
req(cve, "CVE", "severity", /severity\s+Severity/);
req(cve, "CVE", "affectedUnits", /affectedUnits\s+Int/);
req(cve, "CVE", "status", /status\s+String/);

const obl = block("model", "Obligation");
req(obl, "Obligation", "account", /account\s+String/);
req(obl, "Obligation", "obligation", /obligation\s+String/);
req(obl, "Obligation", "actual", /actual\s+String/);
req(obl, "Obligation", "state", /state\s+String/);

const el = block("model", "ExportLicense");
req(el, "ExportLicense", "destination", /destination\s+String/);
req(el, "ExportLicense", "code", /code\s+String/);
req(el, "ExportLicense", "state", /state\s+String/);

const lm = block("model", "LegalMatter");
req(lm, "LegalMatter", "type", /type\s+String/);
req(lm, "LegalMatter", "title", /title\s+String/);
req(lm, "LegalMatter", "linkedTo", /linkedTo\s+String/);
req(lm, "LegalMatter", "status", /status\s+String/);

// --- Severity reused, not redefined -----------------------------------------
const severityDefs = (schema.match(/^enum\s+Severity\b/gm) ?? []).length;
if (severityDefs !== 1) {
  fail(
    `Severity must be defined exactly once (found ${severityDefs}); reuse §3.5`,
  );
}

// --- moat /// pointers -------------------------------------------------------
for (const story of ["TEL.1", "MEM.1", "ONT.2", "RBAC.4", "AUDIT.3"]) {
  if (!schema.includes(story))
    fail(`robotics/back-office /// pointer must reference ${story}`);
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
  console.error(`FND.10 verify FAILED — ${errors.length} issue(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  `FND.10 verify OK — ${models.length} robotics/back-office models; Severity reused; orgId + FK/read-path indexes; TEL.1/MEM.1/ONT.2/RBAC.4/AUDIT.3 pointers; schema valid; client generated.`,
);
