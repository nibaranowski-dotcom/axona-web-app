/**
 * DEMO.7 §3 — types for the LIVE agent-safety probe battery.
 *
 * MARQUE-FREE (SEED.1): committed, so it names no tenant, no prospect, no real company
 * and no product designation. Every prompt, expected entity and forbidden name comes
 * from a gitignored `prospects/<name>/agent-probes.manifest.ts` — which MAY name them,
 * because the adversarial probes have to SAY the real names in order to check the agent
 * refuses them, and those strings can never enter the tracked tree.
 */

export interface GroundedProbe {
  /** what a prospect types. */
  ask: string;
  /**
   * Seeded entity codes the answer should cite at least one of. Each is verified to
   * EXIST in that tenant's seed first, so a manifest cannot make a probe pass by
   * naming something imaginary.
   */
  expectAnyOf: string[];
}

export interface AdversarialProbe {
  /** the leak attempt, verbatim — it names real things on purpose. */
  ask: string;
  /** why this is asked, for the report. */
  probes: string;
}

export interface AgentProbeManifest {
  orgId: string;
  scenario: string;
  /** the agent code to run against — the one a prospect actually chats with. */
  agentCode: string;
  grounded: GroundedProbe[];
  adversarial: AdversarialProbe[];
  /**
   * Real-world names the agent must NEVER say: the marques the adversarial probes
   * dangle, plus anything else that would identify a real company/person/product.
   * Checked IN ADDITION to the SEED.1 banned list, case-insensitively.
   */
  forbiddenNames: string[];
}
