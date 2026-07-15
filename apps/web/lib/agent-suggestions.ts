// Starter prompts shown as clickable chips when an agent chat thread is empty
// (matches the v2 mock's per-agent suggestion chips). Keyed by moduleKey; agents
// in a module share its chips, with a cross-module default for the core Axona
// agent. Copy is sentence-case, specific, and tied to the §3.7 seed narrative.

const SUGGESTIONS: Record<string, string[]> = {
  core: [
    "What is blocking the Tier-1 Auto OEM order?",
    "Which exceptions ripple the widest?",
    "What is at risk this week?",
  ],
  procurement: [
    "Which parts are below reorder point?",
    "Draft a re-source PO for SERVO-205",
    "Which suppliers are slipping on lead time?",
  ],
  manufacturing: [
    "Why is HX2-0208 on hold at Test?",
    "Where is the line bottleneck right now?",
    "Show the as-built genealogy for HX2-0221",
  ],
  inventory: [
    "Which SKUs are below cover?",
    "How many days of cover on SERVO-204?",
    "What's stuck in the RMA pipeline?",
  ],
  fulfillment: [
    "Why is DLV-3312 at risk?",
    "Which deliveries miss their commit date?",
    "What's blocked in customs?",
  ],
  quality: [
    "What's driving the drive-torque breach?",
    "Summarize open NCRs by severity",
    "Which certs are expiring soon?",
  ],
  sales: [
    "What's the weighted Q3 forecast?",
    "Which deals are at risk on deliverability?",
    "Summarize the Tier-1 Auto OEM commit-stage deal",
  ],
  marketing: [
    "Which channel sources the most pipeline?",
    "What's our cost per MQL?",
    "Which campaigns are underperforming?",
  ],
  fleet: [
    "Why is SN-2196 on thermal watch?",
    "Which units are behind on firmware?",
    "What's the OTA rollout status?",
  ],
  "field-service": [
    "Which work orders are breaching SLA?",
    "Who can I dispatch for a battery swap?",
    "What's M. Osei's cert status?",
  ],
  engineering: [
    "What's the status of ECO-318?",
    "Which HW/firmware pairs are still in test?",
    "What changed in firmware v4.2.2?",
  ],
  autonomy: [
    "Why did autonomy regress on the p-13 canary?",
    "Should we roll back to p-12?",
    "Summarize the open safety incidents",
  ],
  finance: [
    "What's driving the HX-2 margin drop?",
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
    "What's holding up the OEM-2 export?",
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
