/**
 * Verify FND.9 — Prisma value-chain entities (build-spec §3.5).
 *
 * Run: `pnpm verify:fnd-9`
 *   1. All §3.5 models + enums exist with the right fields/types.
 *   2. Every model is tenant-owned: scalar orgId + @@index([orgId]).
 *   3. FK indexes (PurchaseOrder supplierId/partId/draftedByAgentId) +
 *      read-path indexes (SpcSample [characteristic, ts]; Delivery [stage]).
 *   4. Moat /// pointers: ONT.2 (WorkOrderMfg.serial), RBAC.4 + AUDIT.3
 *      (PurchaseOrder), MEM.1 (SpcSample).
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
  console.error(`FND.9 verify FAILED — missing ${SCHEMA_REL}`);
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

// Every value-chain model must be tenant-owned with an orgId index.
const tenantModels = [
  "Supplier",
  "Part",
  "PurchaseOrder",
  "WorkOrderMfg",
  "NCR",
  "SpcSample",
  "Cert",
  "Deal",
  "Campaign",
  "Delivery",
];
for (const name of tenantModels) {
  const b = block("model", name);
  if (!b) {
    fail(`model ${name} missing`);
    continue;
  }
  req(b, name, "orgId", /orgId\s+String/);
  req(b, name, "@@index([orgId])", /@@index\(\[orgId\]\)/);
}

// --- field-level checks ------------------------------------------------------
const supplier = block("model", "Supplier");
req(supplier, "Supplier", "tier", /tier\s+Int/);
req(supplier, "Supplier", "riskScore", /riskScore\s+Float/);
req(supplier, "Supplier", "onTimePct", /onTimePct\s+Float/);

const part = block("model", "Part");
req(part, "Part", "sku", /sku\s+String/);
req(part, "Part", "onHand", /onHand\s+Int/);
req(part, "Part", "reorderPoint", /reorderPoint\s+Int/);
req(part, "Part", "leadDays", /leadDays\s+Int/);

const po = block("model", "PurchaseOrder");
req(po, "PurchaseOrder", "code", /code\s+String/);
req(po, "PurchaseOrder", "supplierId", /supplierId\s+String/);
req(po, "PurchaseOrder", "partId", /partId\s+String/);
req(po, "PurchaseOrder", "qty", /qty\s+Int/);
req(po, "PurchaseOrder", "value", /value\s+Float/);
req(po, "PurchaseOrder", "status", /status\s+POStatus/);
req(po, "PurchaseOrder", "draftedByAgentId", /draftedByAgentId\s+String\?/);
req(po, "PurchaseOrder", "eta", /eta\s+DateTime\?/);
req(po, "PurchaseOrder", "@@index([supplierId])", /@@index\(\[supplierId\]\)/);
req(po, "PurchaseOrder", "@@index([partId])", /@@index\(\[partId\]\)/);
req(
  po,
  "PurchaseOrder",
  "@@index([draftedByAgentId])",
  /@@index\(\[draftedByAgentId\]\)/,
);

const wo = block("model", "WorkOrderMfg");
req(wo, "WorkOrderMfg", "serial", /serial\s+String/);
req(wo, "WorkOrderMfg", "product", /product\s+String/);
req(wo, "WorkOrderMfg", "station", /station\s+String/);
req(wo, "WorkOrderMfg", "status", /status\s+String/);
req(wo, "WorkOrderMfg", "startedAt", /startedAt\s+DateTime\?/);

const ncr = block("model", "NCR");
req(ncr, "NCR", "code", /code\s+String/);
req(ncr, "NCR", "defect", /defect\s+String/);
req(ncr, "NCR", "linkedTo", /linkedTo\s+String/);
req(ncr, "NCR", "severity", /severity\s+Severity/);
req(ncr, "NCR", "status", /status\s+String/);

const spc = block("model", "SpcSample");
req(spc, "SpcSample", "characteristic", /characteristic\s+String/);
req(spc, "SpcSample", "serial", /serial\s+String/);
req(spc, "SpcSample", "value", /value\s+Float/);
req(spc, "SpcSample", "ucl", /ucl\s+Float/);
req(spc, "SpcSample", "lcl", /lcl\s+Float/);
req(spc, "SpcSample", "mean", /mean\s+Float/);
req(spc, "SpcSample", "ts", /ts\s+DateTime/);
req(
  spc,
  "SpcSample",
  "@@index([characteristic, ts])",
  /@@index\(\[characteristic,\s*ts\]\)/,
);

const cert = block("model", "Cert");
req(cert, "Cert", "validTo", /validTo\s+DateTime/);
req(cert, "Cert", "scope", /scope\s+String/);

const deal = block("model", "Deal");
req(deal, "Deal", "account", /account\s+String/);
req(deal, "Deal", "config", /config\s+String/);
req(deal, "Deal", "value", /value\s+Float/);
req(deal, "Deal", "stage", /stage\s+DealStage/);
req(deal, "Deal", "closeDate", /closeDate\s+DateTime\?/);
req(deal, "Deal", "feasibility", /feasibility\s+Feasibility/);

const campaign = block("model", "Campaign");
req(campaign, "Campaign", "channel", /channel\s+String/);
req(campaign, "Campaign", "mqls", /mqls\s+Int/);
req(campaign, "Campaign", "pipeline", /pipeline\s+Float/);
req(campaign, "Campaign", "roi", /roi\s+Float/);

const delivery = block("model", "Delivery");
req(delivery, "Delivery", "code", /code\s+String/);
req(delivery, "Delivery", "destination", /destination\s+String/);
req(delivery, "Delivery", "units", /units\s+String/);
req(delivery, "Delivery", "stage", /stage\s+DeliveryStage/);
req(delivery, "Delivery", "committedDate", /committedDate\s+DateTime/);
req(delivery, "Delivery", "etaDate", /etaDate\s+DateTime/);
req(delivery, "Delivery", "riskState", /riskState\s+String/);
req(delivery, "Delivery", "@@index([stage])", /@@index\(\[stage\]\)/);

// --- enums -------------------------------------------------------------------
const enumChecks: Record<string, string[]> = {
  POStatus: ["DRAFTED", "AWAITING_APPROVAL", "APPROVED", "SENT", "RECEIVED"],
  Severity: ["MINOR", "MAJOR", "CRITICAL"],
  DealStage: ["QUALIFY", "DEMO", "PROPOSAL", "NEGOTIATION", "COMMIT"],
  Feasibility: ["ON_TIME", "AT_RISK", "NOT_CHECKED"],
  DeliveryStage: [
    "ALLOC",
    "CRATE",
    "FREIGHT",
    "CUSTOMS",
    "ONSITE",
    "COMMISSION",
    "ACTIVE",
  ],
};
for (const [name, values] of Object.entries(enumChecks)) {
  const b = block("enum", name);
  if (!b) {
    fail(`enum ${name} missing`);
    continue;
  }
  for (const v of values) {
    if (!has(b, new RegExp(`\\b${v}\\b`))) fail(`${name} enum missing ${v}`);
  }
}

// --- moat /// pointers -------------------------------------------------------
for (const story of ["ONT.2", "RBAC.4", "AUDIT.3", "MEM.1"]) {
  if (!schema.includes(story))
    fail(`value-chain /// pointer must reference ${story}`);
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
  console.error(`FND.9 verify FAILED — ${errors.length} issue(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  "FND.9 verify OK — 10 value-chain models + 5 enums; orgId & FK indexes; SpcSample[characteristic,ts] + Delivery[stage]; ONT.2/RBAC.4/AUDIT.3/MEM.1 pointers; schema valid; client generated.",
);
