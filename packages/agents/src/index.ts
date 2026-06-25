/**
 * @axona/agents — the multi-agent intelligence layer (the moat).
 *
 * Lands in epic E3:
 *   ART.1  AgentRuntime — Claude tool-use loop ({ systemPrompt, tools[], scope })
 *   ART.2  Typed tool registry over the data model (Zod I/O)
 *   ART.3  Module orchestrator — cross-module routing -> agent trace
 *   WF.1   Workflow DAG model + BullMQ run engine
 *
 * Agents draft/monitor/act; humans approve money/safety/contract actions.
 */
export const AGENTS_PACKAGE = "@axona/agents" as const;
