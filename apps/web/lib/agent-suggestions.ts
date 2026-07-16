// Starter prompts shown as clickable chips when an agent chat thread is empty
// (matches the v2 mock's per-agent suggestion chips). Keyed by moduleKey; agents
// in a module share its chips, with a cross-module default for the core Axona agent.
//
// PROSPECT.2 — these are ORG-NEUTRAL: generic, data-driven-by-question phrasing with
// NO hardcoded record codes or customer names. A specific tenant's narrative (its
// own orders, parts, cells) is answered live by the agent from that org's records —
// never baked into a chip, so no tenant's data leaks into another's suggestions.

const SUGGESTIONS: Record<string, string[]> = {
  core: [
    "What's blocking the largest open order?",
    "Which exceptions ripple the widest?",
    "What's at risk this week?",
  ],
  procurement: [
    "Which parts are below reorder point?",
    "Draft a re-source PO for a short part",
    "Which suppliers are slipping on lead time?",
  ],
  manufacturing: [
    "Which build is on hold at Test?",
    "Where is the line bottleneck right now?",
    "Show the as-built genealogy for a unit",
  ],
  inventory: [
    "Which SKUs are below cover?",
    "How many days of cover on our critical parts?",
    "What's stuck in the RMA pipeline?",
  ],
  fulfillment: [
    "Which delivery is most at risk?",
    "Which deliveries miss their commit date?",
    "What's blocked in customs?",
  ],
  quality: [
    "What's driving our top SPC breach?",
    "Summarize open NCRs by severity",
    "Which certs are expiring soon?",
  ],
  sales: [
    "What's the weighted forecast this quarter?",
    "Which deals are at risk on deliverability?",
    "Summarize our top commit-stage deal",
  ],
  marketing: [
    "Which channel sources the most pipeline?",
    "What's our cost per MQL?",
    "Which campaigns are underperforming?",
  ],
  fleet: [
    "Which unit is on watch, and why?",
    "Which units are behind on firmware?",
    "What's the OTA rollout status?",
  ],
  "field-service": [
    "Which work orders are breaching SLA?",
    "Who can I dispatch for the next job?",
    "Which techs' certs are current?",
  ],
  engineering: [
    "What's the status of our open ECOs?",
    "Which HW/firmware pairs are still in test?",
    "What changed in the latest firmware?",
  ],
  autonomy: [
    "Why did autonomy regress recently?",
    "Should we roll back the latest policy?",
    "Summarize the open safety incidents",
  ],
  finance: [
    "What's driving our margin trend?",
    "How much runway do we have?",
    "Which invoices are overdue?",
  ],
  people: [
    "Whose certs expire in the next 30 days?",
    "Are we hiring ahead of fleet growth?",
    "Which techs can service HV/battery?",
  ],
  security: [
    "Which CVEs affect deployed units?",
    "What's our MFA coverage?",
    "Which endpoints need patching?",
  ],
  legal: [
    "Which contract obligations are at risk?",
    "What's holding up our export licenses?",
    "Summarize open legal matters",
  ],
  machines: [
    "Which machines need service?",
    "What's plant utilization right now?",
    "Which equipment is in fault?",
  ],
};

/** Three starter prompts for a module's agents (core Axona agent by default). */
export function suggestionsFor(moduleKey: string | undefined): string[] {
  return SUGGESTIONS[moduleKey ?? "core"] ?? SUGGESTIONS.core!;
}
