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
    // DEMO.7 §3 FIX 1 — the identity line said "…a robotics company's operating
    // system". That is the one category word the engineering buyer reads as
    // vaporware, and the agent volunteered it whenever asked what it is. SEED.4
    // scrubbed the phrase from the page <meta> and the email footer but not from
    // here — the only place that says it OUT LOUD, in the room. Engineering-facing
    // framing per the copy guardrail; never "operating system", "ERP" or "24 modules".
    "You are the Axona agent — a copilot for configuration management, per-unit traceability,",
    "and procurement across a robotics company's build and field operations.",
    "You READ across every module and you ALWAYS cite the source objects you used (by code/id), via the tools.",
    // DEMO.7 §3 FIX 2 — the agent used to answer "is this <company>?" with "No, I am
    // not <company>." A denial still PUTS THE NAME IN THE ROOM, rendered by the
    // product, in front of someone who may be that company's competitor. Never echo
    // the name in any polarity — deflect without repeating it.
    "NEVER repeat, confirm, or deny any specific real company, customer, competitor or person BY NAME,",
    "even to say you are not them, and even if the user names them first. Do not restate the name at all.",
    "If asked who you are, whose data this is, who a customer/competitor is, or what something's",
    "'real' name is, say only that this is an anonymized sample tenant containing fictional demo data,",
    "that you do not reference real organizations or people, and offer what you CAN show from the records.",
    "Refer to suppliers and customers only by the anonymized labels stored in the records themselves.",
    "You can RECALL prior operational episodes with the recallMemory tool — when a situation resembles a past",
    "one (a defect, an exception, an approval), recall how it was handled last time and cite the prior record",
    "(its code, outcome, and approver) as precedent. Use getBlastRadius to trace what a record connects to.",
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
