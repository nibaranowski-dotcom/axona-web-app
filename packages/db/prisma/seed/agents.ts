import type { OrgScopedDb } from "../../src";

// ~6 agents per agent-bearing module (build-spec §4 rosters). These power the
// Agents screen, chats, and traces. code = "<prefix>-NN"; roles/descriptions are
// the spec's real agent set (not placeholders).
//
// AGT.3 — the PLM config-management + traceability specialists join the base
// Engineering/Quality/Manufacturing/Inventory rosters (so every org, incl. the
// investor demo, gets them). Each carries an ENFORCED guardrail that pins
// autoAct:false — it DRAFTS/monitors only; a human approves via decide() (RBAC.4).

type AgentDef = {
  role: string;
  description: string;
  /** Explicit display name (else derived from role). */
  name?: string;
  /** AGT.3 — enforced guardrail (the moat invariant). autoAct:false = never acts. */
  guardrails?: Record<string, unknown>;
};

/** A no-auto-act guardrail: draft/monitor only, human approves via decide(). */
const noAutoAct = (mode: "draft" | "monitor", never: string[]) => ({
  autoAct: false,
  mode,
  approval: "human-via-decide",
  never,
});

const ROSTER: Record<string, { prefix: string; agents: AgentDef[] }> = {
  procurement: {
    prefix: "proc",
    agents: [
      {
        role: "SOURCING",
        description: "Finds and ranks suppliers for a part or RFQ.",
      },
      { role: "RFQ", description: "Drafts and tracks requests for quotation." },
      {
        role: "NEGOTIATION",
        description: "Proposes price/terms moves within policy.",
      },
      {
        role: "REORDER",
        description: "Flags parts under reorder point and drafts POs.",
      },
      {
        role: "RECONCILIATION",
        description: "Matches POs, receipts, and invoices.",
      },
      {
        role: "SUPPLY_RISK",
        description: "Scores supplier and lead-time risk.",
      },
    ],
  },
  manufacturing: {
    prefix: "mfg",
    agents: [
      {
        role: "SCHEDULER",
        description: "Sequences work orders across the line.",
      },
      {
        role: "WORK_ORDER",
        description: "Opens and advances build work orders.",
      },
      {
        role: "GENEALOGY",
        description: "Captures per-serial as-built genealogy.",
      },
      {
        role: "OEE",
        description: "Tracks throughput, availability, and quality.",
      },
      {
        role: "KITTING",
        description: "Stages parts/kits ahead of each station.",
      },
      { role: "PM", description: "Plans preventive maintenance windows." },
      // AGT.3 — PLM as-built genealogy specialist (capture only, never fabricates).
      {
        role: "AS_BUILT_GENEALOGY",
        name: "As-built genealogy agent",
        description:
          "Captures as-built genealogy at build (parts·serials·firmware) and flags substitutions vs the as-designed BOM — never fabricates a record.",
        guardrails: noAutoAct("draft", ["auto_substitute", "auto_capture"]),
      },
    ],
  },
  inventory: {
    prefix: "inv",
    agents: [
      { role: "STOCK", description: "Tracks stock by location and movement." },
      {
        role: "REORDER",
        description: "Triggers reorders feeding Procurement.",
      },
      { role: "RMA", description: "Processes returns and warranty swaps." },
      {
        role: "CYCLE_COUNT",
        description: "Schedules and reconciles cycle counts.",
      },
      {
        role: "RESERVATION",
        description: "Reserves stock against open orders.",
      },
      {
        role: "EDGE_CACHE",
        description: "Pre-positions spares near the fleet.",
      },
      // AGT.3 — PLM lot-traceability specialist (monitor only, never quarantines).
      {
        role: "LOT_TRACEABILITY",
        name: "Lot-traceability agent",
        description:
          "Resolves a production lot to the exact units that carry it and its quarantine reach across factories — proposes containment; a human decides.",
        guardrails: noAutoAct("monitor", ["auto_quarantine", "auto_hold"]),
      },
    ],
  },
  fulfillment: {
    prefix: "ful",
    agents: [
      {
        role: "ALLOCATION",
        description: "Allocates built units to deliveries.",
      },
      { role: "FREIGHT", description: "Books and tracks freight legs." },
      { role: "CUSTOMS", description: "Prepares customs/export paperwork." },
      {
        role: "INSTALL_SCHEDULING",
        description: "Schedules on-site install windows.",
      },
      { role: "COMMISSIONING", description: "Drives commissioning sign-off." },
      { role: "DELIVERY_SLA", description: "Watches committed-date risk." },
    ],
  },
  quality: {
    prefix: "qa",
    agents: [
      { role: "INSPECTION", description: "Logs inspections vs spec." },
      {
        role: "SPC",
        description: "Monitors control charts for out-of-spec points.",
      },
      {
        role: "ROOT_CAUSE",
        description: "Correlates defects to lots/processes.",
      },
      {
        role: "NCR_CAPA",
        description: "Opens NCRs and tracks CAPA to closure.",
      },
      {
        role: "CALIBRATION",
        description: "Tracks gauge calibration due dates.",
      },
      {
        role: "COMPLIANCE",
        description: "Keeps CE/UL/ISO evidence audit-ready.",
      },
      // AGT.3 — PLM test-traceability + RCA specialists (draft only; the agent
      // NEVER auto-classifies — a human confirms the cause).
      {
        role: "TEST_TRACEABILITY",
        name: "Test-traceability agent",
        description:
          "Links each test run to its exact unit + frozen config and flags config→outcome deltas between a pass and a fail — assistance only.",
        guardrails: noAutoAct("monitor", ["auto_classify", "auto_pass_fail"]),
      },
      {
        role: "RCA",
        name: "Root-cause agent",
        description:
          "Proposes candidate root causes from config diffs, shared lots and MEM.1 recall of prior failures — with calibrated confidence; a human classifies.",
        guardrails: noAutoAct("draft", ["auto_classify_rca"]),
      },
    ],
  },
  sales: {
    prefix: "sales",
    agents: [
      {
        role: "LEAD_QUALIFICATION",
        description: "Qualifies inbound and ABM leads.",
      },
      { role: "CPQ", description: "Configures complex SKUs and prices them." },
      {
        role: "FEASIBILITY",
        description: "Checks ops can build+deliver by the date.",
      },
      { role: "FORECAST", description: "Rolls up the pipeline forecast." },
      { role: "CONTRACT", description: "Drafts and redlines contracts." },
      { role: "RENEWAL", description: "Manages RaaS renewals." },
    ],
  },
  marketing: {
    prefix: "mkt",
    agents: [
      { role: "CAMPAIGN", description: "Plans and tracks campaigns." },
      { role: "CONTENT", description: "Drafts content for channels." },
      { role: "ABM", description: "Runs account-based plays." },
      {
        role: "LEAD_NURTURE",
        description: "Nurtures and hands SQLs to Sales.",
      },
      { role: "ATTRIBUTION", description: "Attributes pipeline by channel." },
      {
        role: "EVENTS",
        description: "Runs the events motion (dominant channel).",
      },
    ],
  },
  fleet: {
    prefix: "fleet",
    agents: [
      {
        role: "TELEMETRY",
        description: "Ingests and summarizes robot telemetry.",
      },
      {
        role: "PREDICTIVE_MAINTENANCE",
        description: "Predicts failures (e.g. thermal).",
      },
      { role: "UPTIME_SLA", description: "Tracks per-customer uptime SLAs." },
      { role: "OTA", description: "Manages OTA firmware rollouts." },
      { role: "ANOMALY", description: "Flags anomalous unit behavior." },
      { role: "ENERGY", description: "Optimizes charge/energy use." },
    ],
  },
  "field-service": {
    prefix: "field",
    agents: [
      {
        role: "DISPATCH",
        description: "Routes the right certified tech with the right part.",
      },
      {
        role: "TRIAGE",
        description: "Triages incoming work orders by severity/SLA.",
      },
      { role: "PARTS", description: "Confirms parts availability for a job." },
      { role: "SCHEDULING", description: "Builds each tech's daily schedule." },
      {
        role: "KNOWLEDGE",
        description: "Surfaces fix knowledge for the issue.",
      },
      { role: "PM", description: "Schedules field preventive maintenance." },
    ],
  },
  engineering: {
    prefix: "eng",
    agents: [
      {
        role: "CHANGE",
        description: "Moves ECOs through Draft→Review→Approved→Released.",
      },
      {
        role: "COMPATIBILITY",
        description: "Maintains HW↔firmware compatibility.",
      },
      {
        role: "FIRMWARE_RELEASE",
        description: "Gates firmware releases on cert.",
      },
      { role: "IMPACT", description: "Assesses change impact across modules." },
      { role: "REQUIREMENTS", description: "Tracks requirements to changes." },
      { role: "CAD_CONFIG", description: "Manages CAD/config variants." },
      // AGT.3 — PLM configuration + change-order specialists. Draft only: the
      // config agent NEVER auto-baselines; the change agent NEVER auto-releases.
      {
        role: "CONFIGURATION",
        name: "Configuration agent",
        description:
          "Drafts and validates named production config baselines and surfaces which units match a baseline — a human locks it via decide().",
        guardrails: noAutoAct("draft", ["auto_baseline", "auto_lock"]),
      },
      {
        role: "CHANGE_ORDER",
        name: "Change-order agent",
        description:
          "Drafts an ECR→ECO with effectivity and computes the affected-units rollout across factories — a human releases it via decide().",
        guardrails: noAutoAct("draft", [
          "auto_release_eco",
          "auto_effectivity",
        ]),
      },
    ],
  },
  autonomy: {
    prefix: "auto",
    agents: [
      { role: "MISSION", description: "Tracks mission success per site." },
      {
        role: "INTERVENTION",
        description: "Analyzes takeovers/interventions.",
      },
      {
        role: "SAFETY",
        description: "Reviews safety incidents and near-misses.",
      },
      { role: "POLICY", description: "Manages policy versions and rollback." },
      {
        role: "SIMULATION",
        description: "Validates a policy in sim before promotion.",
      },
      { role: "SLA", description: "Tracks autonomy-rate SLAs." },
    ],
  },
  finance: {
    prefix: "fin",
    agents: [
      {
        role: "REVENUE_RECOGNITION",
        description: "Splits lumpy hardware vs ratable RaaS.",
      },
      {
        role: "UNIT_ECONOMICS",
        description: "Tracks per-unit margin and drift.",
      },
      {
        role: "COLLECTIONS",
        description: "Chases AR aging and overdue invoices.",
      },
      { role: "PAYABLES", description: "Manages payables and terms." },
      { role: "FPA", description: "Runs FP&A and cash/runway." },
      { role: "CLOSE", description: "Drives the monthly close." },
    ],
  },
  people: {
    prefix: "ppl",
    agents: [
      {
        role: "CERTIFICATION",
        description: "Tracks cert expiry that gates dispatch.",
      },
      { role: "RECRUITING", description: "Manages requisitions and pipeline." },
      { role: "ONBOARDING", description: "Runs new-hire onboarding." },
      {
        role: "WORKFORCE_PLANNING",
        description: "Plans field-team vs fleet growth.",
      },
      { role: "SKILLS", description: "Maps skills/competencies." },
      {
        role: "SCHEDULING",
        description: "Schedules workforce against demand.",
      },
    ],
  },
  security: {
    prefix: "sec",
    agents: [
      {
        role: "CVE_TRIAGE",
        description: "Triages CVEs affecting deployed units.",
      },
      { role: "POSTURE", description: "Tracks device security posture." },
      { role: "ACCESS", description: "Manages access and least-privilege." },
      {
        role: "PATCH",
        description: "Coordinates signed-firmware patch rollouts.",
      },
      {
        role: "ANOMALY_TRAFFIC",
        description: "Detects anomalous device traffic.",
      },
      { role: "AUDIT", description: "Maintains the security audit trail." },
    ],
  },
  legal: {
    prefix: "legal",
    agents: [
      {
        role: "OBLIGATIONS",
        description: "Tracks contract obligations vs live ops.",
      },
      { role: "CONTRACT", description: "Manages contract lifecycle." },
      {
        role: "EXPORT_CONTROL",
        description: "Handles export licensing (EAR99 etc.).",
      },
      { role: "COMPLIANCE", description: "Tracks regulatory compliance." },
      { role: "LIABILITY", description: "Manages liability matters." },
      { role: "IP", description: "Manages IP/patent matters." },
    ],
  },
  machines: {
    prefix: "mach",
    agents: [
      {
        role: "MAINTENANCE",
        description: "Flags what needs service and drafts PM schedules.",
      },
      {
        role: "PREDICTIVE",
        description: "Predicts failures from machine telemetry.",
      },
      {
        role: "SCHEDULER",
        description: "Books service into off-shift windows.",
      },
      {
        role: "TELEMETRY",
        description: "Ingests and monitors machine signals.",
      },
      {
        role: "CALIBRATION",
        description: "Tracks re-cal due dates and drift.",
      },
      {
        role: "UTILIZATION",
        description: "Tracks utilization across the floor.",
      },
    ],
  },
};

export async function seedAgents(db: OrgScopedDb): Promise<number> {
  let count = 0;
  for (const [moduleKey, { prefix, agents }] of Object.entries(ROSTER)) {
    let i = 1;
    for (const a of agents) {
      const code = `${prefix}-${String(i).padStart(2, "0")}`;
      const name =
        a.name ??
        `${a.role
          .toLowerCase()
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())} agent`;
      await db.agent.create({
        data: {
          orgId: db.$org,
          moduleKey,
          name,
          code,
          role: a.role,
          description: a.description,
          guardrails: (a.guardrails ?? undefined) as never,
        },
      });
      count++;
      i++;
    }
  }

  // The general Axona agent (GA.1): scope "core", read-only cross-module copilot.
  // Code kept in sync with AXONA_AGENT_CODE in @axona/agents (no import — avoids a
  // db→agents dependency). getAxonaAgent() also ensures this row idempotently.
  await db.agent.create({
    data: {
      orgId: db.$org,
      moduleKey: "core",
      name: "Axona agent",
      code: "axona-00",
      role: "AXONA",
      description:
        "Cross-module copilot — reads everything, cites sources, routes actions.",
    },
  });
  count++;

  return count;
}
