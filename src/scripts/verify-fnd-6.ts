/**
 * Verify FND.6 — Prisma Agents/Chats/Workflows/Runs schema (build-spec §3.2).
 *
 * Run: `pnpm verify:fnd-6`
 *   1. All §3.2 models + enums exist with the right fields.
 *   2. Tenant-owned models (Agent/Chat/Workflow) carry orgId + @@index([orgId]);
 *      run/message children carry an indexed FK to their parent.
 *   3. `trace` stays Json with a /// pointer to ONT.1/CONF.1/AUDIT.3 and NO
 *      event-log / confidence / approver columns yet.
 *   4. `prisma validate` passes and `prisma generate` succeeds.
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
  console.error(`FND.6 verify FAILED — missing ${SCHEMA_REL}`);
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

// --- Agent -------------------------------------------------------------------
const agent = block("model", "Agent");
if (!agent) fail("model Agent missing");
requireField(agent, "Agent", "orgId", /orgId\s+String/);
requireField(agent, "Agent", "moduleKey", /moduleKey\s+String/);
requireField(agent, "Agent", "code", /code\s+String/);
requireField(agent, "Agent", "role", /role\s+String/);
requireField(agent, "Agent", "description", /description\s+String/);
requireField(agent, "Agent", "state", /state\s+AgentState\s+@default\(LIVE\)/);
requireField(agent, "Agent", "runs", /runs\s+AgentRun\[\]/);
requireField(agent, "Agent", "@@index([orgId])", /@@index\(\[orgId\]\)/);

for (const v of ["LIVE", "WORKING", "CRITICAL", "OFFLINE"]) {
  if (!has(block("enum", "AgentState"), new RegExp(`\\b${v}\\b`)))
    fail(`AgentState enum missing ${v}`);
}

// --- Chat --------------------------------------------------------------------
const chat = block("model", "Chat");
if (!chat) fail("model Chat missing");
requireField(chat, "Chat", "orgId", /orgId\s+String/);
requireField(chat, "Chat", "agentId", /agentId\s+String\?/);
requireField(chat, "Chat", "userId", /userId\s+String/);
requireField(chat, "Chat", "scope", /scope\s+String/);
requireField(chat, "Chat", "messages", /messages\s+Message\[\]/);
requireField(chat, "Chat", "@@index([orgId])", /@@index\(\[orgId\]\)/);
requireField(chat, "Chat", "@@index([agentId])", /@@index\(\[agentId\]\)/);
requireField(chat, "Chat", "@@index([userId])", /@@index\(\[userId\]\)/);

// --- Message -----------------------------------------------------------------
const message = block("model", "Message");
if (!message) fail("model Message missing");
requireField(message, "Message", "chatId", /chatId\s+String/);
requireField(
  message,
  "Message",
  "chat relation",
  /chat\s+Chat\s+@relation\(fields:\s*\[chatId\],\s*references:\s*\[id\]\)/,
);
requireField(message, "Message", "role", /role\s+MsgRole/);
requireField(message, "Message", "text", /text\s+String/);
requireField(message, "Message", "citations", /citations\s+Json\?/);
requireField(message, "Message", "@@index([chatId])", /@@index\(\[chatId\]\)/);

for (const v of ["USER", "AGENT", "SYSTEM"]) {
  if (!has(block("enum", "MsgRole"), new RegExp(`\\b${v}\\b`)))
    fail(`MsgRole enum missing ${v}`);
}

// --- Workflow ----------------------------------------------------------------
const workflow = block("model", "Workflow");
if (!workflow) fail("model Workflow missing");
requireField(workflow, "Workflow", "orgId", /orgId\s+String/);
requireField(workflow, "Workflow", "moduleKey", /moduleKey\s+String/);
requireField(
  workflow,
  "Workflow",
  "status",
  /status\s+WorkflowStatus\s+@default\(DRAFT\)/,
);
requireField(workflow, "Workflow", "trigger", /trigger\s+Json/);
requireField(workflow, "Workflow", "steps", /steps\s+Json/);
requireField(workflow, "Workflow", "runs", /runs\s+WorkflowRun\[\]/);
requireField(workflow, "Workflow", "@@index([orgId])", /@@index\(\[orgId\]\)/);

for (const v of ["DRAFT", "ACTIVE", "PAUSED"]) {
  if (!has(block("enum", "WorkflowStatus"), new RegExp(`\\b${v}\\b`)))
    fail(`WorkflowStatus enum missing ${v}`);
}

// --- WorkflowRun -------------------------------------------------------------
const wfRun = block("model", "WorkflowRun");
if (!wfRun) fail("model WorkflowRun missing");
requireField(wfRun, "WorkflowRun", "workflowId", /workflowId\s+String/);
requireField(
  wfRun,
  "WorkflowRun",
  "workflow relation",
  /workflow\s+Workflow\s+@relation\(fields:\s*\[workflowId\],\s*references:\s*\[id\]\)/,
);
requireField(wfRun, "WorkflowRun", "status", /status\s+RunStatus/);
requireField(wfRun, "WorkflowRun", "trace", /trace\s+Json/);
requireField(wfRun, "WorkflowRun", "endedAt", /endedAt\s+DateTime\?/);
requireField(
  wfRun,
  "WorkflowRun",
  "@@index([workflowId])",
  /@@index\(\[workflowId\]\)/,
);

for (const v of ["RUNNING", "SUCCEEDED", "FAILED"]) {
  if (!has(block("enum", "RunStatus"), new RegExp(`\\b${v}\\b`)))
    fail(`RunStatus enum missing ${v}`);
}

// --- AgentRun ----------------------------------------------------------------
const agentRun = block("model", "AgentRun");
if (!agentRun) fail("model AgentRun missing");
requireField(agentRun, "AgentRun", "agentId", /agentId\s+String/);
requireField(
  agentRun,
  "AgentRun",
  "agent relation",
  /agent\s+Agent\s+@relation\(fields:\s*\[agentId\],\s*references:\s*\[id\]\)/,
);
requireField(agentRun, "AgentRun", "input", /input\s+Json/);
requireField(agentRun, "AgentRun", "trace", /trace\s+Json/);
requireField(agentRun, "AgentRun", "status", /status\s+RunStatus/);
requireField(
  agentRun,
  "AgentRun",
  "@@index([agentId])",
  /@@index\(\[agentId\]\)/,
);

// --- trace pointer + NO premature columns -----------------------------------
for (const story of ["ONT.1", "CONF.1", "AUDIT.3"]) {
  if (!schema.includes(story)) {
    fail(`trace /// pointer must reference ${story}`);
  }
}
for (const banned of ["confidence", "approver"]) {
  if (new RegExp(`^\\s*${banned}\\s+`, "m").test(schema)) {
    fail(
      `schema must NOT add a \`${banned}\` column yet (lands in CONF.1/AUDIT.3)`,
    );
  }
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
  console.error(`FND.6 verify FAILED — ${errors.length} issue(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  "FND.6 verify OK — Agent/Chat/Message/Workflow/WorkflowRun/AgentRun + 4 enums; orgId & FK indexes; trace -> ONT.1/CONF.1/AUDIT.3; no confidence/approver yet; schema valid; client generated.",
);
