import type { AgentDef, Tool } from "../runtime/types";
import { axonaSystemPrompt } from "../agents/axona";
import { coreTools } from "./core";
import { procurementTools } from "./procurement";
import { qualityTools } from "./quality";
import { engineeringTools } from "./engineering";
import { fieldServiceTools } from "./field-service";
import { financeTools } from "./finance";
import { inventoryTools } from "./inventory";

// The typed tool registry (ART.2): module → tools, plus a cross-module core set.
// buildAgentDef wires an agent with its module's tools + core reads; the core
// agent gets cross-module reads only.

const byModule: Record<string, Tool[]> = {
  procurement: procurementTools,
  quality: qualityTools,
  engineering: engineeringTools,
  "field-service": fieldServiceTools,
  finance: financeTools,
  inventory: inventoryTools,
};

const ALL: Tool[] = [...coreTools, ...Object.values(byModule).flat()];
const BY_NAME = new Map<string, Tool>(ALL.map((t) => [t.name, t]));

function coreReadTools(): Tool[] {
  return coreTools.filter((t) => t.category === "read");
}

/** Every read tool across every module (+ core) — the general Axona agent's set. */
function readToolsAcrossModules(): Tool[] {
  return ALL.filter((t) => t.category === "read");
}

export const registry = {
  byModule,
  coreTools,
  coreReadTools,
  readToolsAcrossModules,
  all: (): Tool[] => ALL,
  byName: (name: string): Tool => {
    const t = BY_NAME.get(name);
    if (!t) throw new Error(`unknown tool: ${name}`);
    return t;
  },
};

function systemPromptFor(agent: { role: string; description: string }): string {
  return (
    `You are the ${agent.role} agent. ${agent.description}\n\n` +
    "Use read tools to gather facts and cite the records you used. You may draft " +
    "and open records (e.g. draft a PO, open an NCR) autonomously. You must NOT " +
    "place, send, release, or pay — those are gated and only proposed for human " +
    "approval. Never claim a result you did not get from a tool. " +
    "Do not use emoji in your responses."
  );
}

/** Replaces the ART.1 stub — assembles tools from the agent's module + core reads.
 *  The core/Axona agent (GA.1) gets READ-ONLY tools across every module and the
 *  cite-always + read-and-route prompt — it never drafts or acts. */
export function buildAgentDef(agent: {
  moduleKey: string;
  role: string;
  description: string;
}): AgentDef {
  if (agent.moduleKey === "core") {
    return {
      systemPrompt: axonaSystemPrompt(),
      tools: readToolsAcrossModules(),
      scope: "core",
    };
  }
  const moduleTools = byModule[agent.moduleKey] ?? [];
  return {
    systemPrompt: systemPromptFor(agent),
    tools: [...moduleTools, ...coreReadTools()],
    scope: agent.moduleKey,
  };
}

/** Test helper (exported for verify): an AgentDef from a set of tool names. */
export function testDef(toolNames: string[]): AgentDef {
  return {
    systemPrompt: "test agent",
    tools: ALL.filter((t) => toolNames.includes(t.name)),
    scope: "test",
  };
}
