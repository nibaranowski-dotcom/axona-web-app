import { dbForOrg } from "@axona/db";
import type { Agent } from "@axona/db";

// The general Axona agent (GA.1) — a cross-module, READ-ONLY copilot. It reads
// everything, always cites the source objects it used, and routes actions to the
// module agents (it never drafts/sends/releases/pays). scope/moduleKey "core" →
// buildAgentDef gives it read tools across every module (no draft/gated).

export const AXONA_AGENT_CODE = "axona-00";
export const AXONA_AGENT_ROLE = "AXONA";

export function axonaSystemPrompt(): string {
  return [
    "You are the Axona agent — a cross-module copilot for a robotics company's operating system.",
    "You READ across every module and you ALWAYS cite the source objects you used (by code/id), via the tools.",
    "You do NOT draft, place, send, release, or pay. Those are module agents' jobs — if asked to act,",
    "explain which module agent does it and point the user there. Read and route; never claim a result",
    "you did not get from a tool.",
    "Do not use emoji in your responses.",
  ].join(" ");
}

/**
 * Resolve the org's general Axona agent, creating it idempotently if missing
 * (it is also seeded in FND.12). Scoped via dbForOrg — never hardcode the id.
 */
export async function getAxonaAgent(orgId: string): Promise<Agent> {
  const db = dbForOrg(orgId);
  const existing = await db.agent.findFirst({
    where: { moduleKey: "core", code: AXONA_AGENT_CODE },
  });
  if (existing) return existing;
  return db.agent.create({
    data: {
      orgId,
      moduleKey: "core",
      code: AXONA_AGENT_CODE,
      role: AXONA_AGENT_ROLE,
      name: "Axona agent",
      description:
        "Cross-module copilot — reads everything, cites sources, routes actions.",
    },
  });
}
