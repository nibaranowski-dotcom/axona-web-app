// SEED.5 — the DOMAIN PACK: one tenant's industry vocabulary, as data.
//
// WHY THIS EXISTS. The prospect seed used to force ONE shared narrative
// (`seedTenantModules`) into EVERY prospect org before the config's own seed() ran.
// That narrative is drone/humanoid — actuator drives, harmonic reducers, torque SPC,
// Frame Build → Drive Integration stations. On a defense tenant it is on-narrative; on
// a warehouse-automation tenant it is pollution that buries the tenant's own records
// under a competitor's product category. A demo tenant must carry ONLY its own domain.
//
// The fix is not a second copy of the seed. Every module screen needs the same SHAPE
// (a populated PO queue, an SPC chart that breaches, a cert matrix, a dispatch board);
// only the VOCABULARY differs. So the generators are parameterised by a pack, and each
// prospect config passes the pack for its industry plus its own code prefix.
//
// MARQUE-FREE (SEED.1): this file is committed, so it names no real company, product or
// person. Part names, stations and defects are generic industry terms; customers are the
// anonymized OEM labels the rest of the repo uses. The tenant-identifying bit — the code
// PREFIX (and the tenant's own hero records) — lives in the gitignored prospect config
// and is passed in at call time, never hardcoded here.

import type { OrgScopedDb } from "../../src";

export type SeverityLevel = "MINOR" | "MAJOR" | "CRITICAL";

export interface PartSpec {
  /** code SUFFIX — the caller prefixes it (`NM-` / `DC-`) so tenants never collide. */
  sku: string;
  name: string;
  onHand: number;
  reorderPoint: number;
  leadDays: number;
}

export interface SupplierSpec {
  name: string;
  tier: number;
  riskScore: number;
  onTimePct: number;
}

export interface DomainPack {
  /** short label for comments/logs — never rendered. */
  key: string;
  /** what this tenant builds, as a product-family label (e.g. "picking cell"). */
  productNoun: string;
  /** the finished-good unit-economics label. */
  productLabel: string;

  suppliers: SupplierSpec[];
  parts: PartSpec[];
  /** assembly stations, in build order — the manufacturing board's columns. */
  stations: string[];

  /** the SPC characteristic that drifts out of control on this line. */
  spc: {
    characteristic: string;
    unit: string;
    ucl: number;
    lcl: number;
    mean: number;
    /** 24 points: in control, then a late drift with the last two over UCL. */
    values: number[];
  };

  /** NCR defect vocabulary — first entry is the one the SPC breach raises. */
  defects: { defect: string; severity: SeverityLevel }[];

  /** anonymized customer labels (SEED.1 — never a real marque). */
  customers: string[];
  /** deployment/plant sites. */
  sites: string[];

  fleet: {
    model: string;
    firmwares: string[];
    /** field-service issue vocabulary. */
    issues: string[];
    /** safety-incident types. */
    incidentTypes: string[];
  };

  /** engineering-change vocabulary. */
  ecos: { title: string; changeType: string; affected: string }[];
  /** compatibility-matrix axes. */
  compat: { hwRevs: string[]; fwVersions: string[] };
  /** certifications this industry carries. */
  certs: { name: string; scope: string }[];

  /** commercial: deal configs + marketing channels. */
  deals: { config: string; value: number }[];
  campaigns: { name: string; channel: string }[];

  /** back office. */
  ledgerAccounts: string[];
  unitEconomics: {
    product: string;
    asp: number;
    cogs: number;
    trend: string;
  }[];
  hiringRoles: string[];
  obligations: { obligation: string; actual: string }[];
  exportDestinations: string[];
  legalMatters: { type: string; title: string }[];

  /** workspace: project names per module. */
  projects: { moduleKey: string; name: string; description: string }[];
  /** matrix questions — the extraction columns on a sourcing project. */
  matrixQuestions: string[];
  /** workflow definitions (name + description); steps are generated. */
  workflows: { moduleKey: string; name: string; description: string }[];
}

/**
 * DRONE / DEFENSE — the vocabulary the shared base narrative always used. Moving it
 * behind a pack is what lets it stay on ONE tenant (where it is on-narrative) instead
 * of leaking into every prospect.
 */
export const DRONE_PACK: DomainPack = {
  key: "drone",
  productNoun: "airframe",
  productLabel: "Airframe",
  // Lettered to continue past the vendors a defense config typically names itself
  // (A–D), so the backdrop extends the vendor list instead of duplicating it.
  suppliers: [
    {
      name: "Vendor E (RF/datalink)",
      tier: 2,
      riskScore: 0.27,
      onTimePct: 95.8,
    },
    { name: "Vendor F (optics)", tier: 3, riskScore: 0.22, onTimePct: 97.8 },
    { name: "Vendor G (thermal)", tier: 2, riskScore: 0.35, onTimePct: 93.4 },
    {
      name: "Vendor H (propulsion)",
      tier: 1,
      riskScore: 0.29,
      onTimePct: 96.1,
    },
    { name: "Vendor J (avionics)", tier: 1, riskScore: 0.19, onTimePct: 98.2 },
    {
      name: "Vendor K (composites)",
      tier: 3,
      riskScore: 0.16,
      onTimePct: 98.9,
    },
  ],
  parts: [
    {
      sku: "PROP-14",
      name: "Propeller assembly (14in)",
      onHand: 42,
      reorderPoint: 20,
      leadDays: 18,
    },
    {
      sku: "ESC-40",
      name: "Electronic speed controller (40A)",
      onHand: 26,
      reorderPoint: 15,
      leadDays: 24,
    },
    {
      sku: "GPS-9",
      name: "GNSS receiver module",
      onHand: 18,
      reorderPoint: 10,
      leadDays: 30,
    },
    {
      sku: "IMU-7",
      name: "Inertial measurement unit",
      onHand: 12,
      reorderPoint: 12,
      leadDays: 35,
    },
    {
      sku: "DATALINK-5",
      name: "Encrypted datalink radio",
      onHand: 7,
      reorderPoint: 8,
      leadDays: 45,
    },
    {
      sku: "GIMBAL-3",
      name: "Stabilised camera gimbal",
      onHand: 9,
      reorderPoint: 6,
      leadDays: 38,
    },
    {
      sku: "ARM-FOLD",
      name: "Folding arm assembly",
      onHand: 31,
      reorderPoint: 14,
      leadDays: 21,
    },
    {
      sku: "LANDING-2",
      name: "Landing gear set",
      onHand: 24,
      reorderPoint: 10,
      leadDays: 16,
    },
    {
      sku: "ANTENNA-6",
      name: "Directional antenna array",
      onHand: 15,
      reorderPoint: 8,
      leadDays: 28,
    },
    {
      sku: "THERMAL-4",
      name: "Thermal imaging core",
      onHand: 5,
      reorderPoint: 6,
      leadDays: 52,
    },
    {
      sku: "BATT-SMART",
      name: "Smart battery pack",
      onHand: 33,
      reorderPoint: 18,
      leadDays: 26,
    },
    {
      sku: "SHELL-C",
      name: "Composite fuselage shell",
      onHand: 20,
      reorderPoint: 9,
      leadDays: 33,
    },
  ],
  stations: [
    "Shell Layup",
    "Avionics Integration",
    "Propulsion",
    "Datalink Pairing",
    "Flight Test",
    "Pack-out",
  ],
  spc: {
    characteristic: "hover_current_A",
    unit: "A",
    ucl: 18.4,
    lcl: 15.2,
    mean: 16.8,
    values: [
      16.2, 16.8, 16.5, 17.0, 16.7, 17.2, 16.4, 16.9, 17.1, 16.6, 17.3, 17.0,
      16.5, 16.9, 17.4, 17.1, 17.6, 17.2, 17.5, 17.8, 17.6, 18.0, 18.6, 18.9,
    ],
  },
  defects: [
    { defect: "Hover current over UCL (propulsion drag)", severity: "MAJOR" },
    { defect: "Datalink packet loss at range", severity: "CRITICAL" },
    { defect: "GNSS fix acquisition slow", severity: "MINOR" },
    { defect: "Composite shell bond-line void", severity: "MAJOR" },
    { defect: "Gimbal stabilisation drift", severity: "MINOR" },
  ],
  customers: [
    "Gov Customer A",
    "Gov Customer B",
    "Integrator-1",
    "Integrator-2",
  ],
  sites: ["Northern Range", "Coastal Test Site", "Depot East", "Depot West"],
  fleet: {
    model: "Fixed-wing VTOL",
    firmwares: ["fw-4.2.1", "fw-4.3.0", "fw-4.3.2"],
    issues: [
      "Datalink dropout on egress leg",
      "Battery pack under-delivering capacity",
      "Gimbal re-calibration overdue",
      "Propeller vibration above threshold",
      "GNSS antenna seating fault",
    ],
    incidentTypes: [
      "Unplanned descent",
      "Geofence breach",
      "Link loss > 30s",
      "Ground handling damage",
    ],
  },
  ecos: [
    {
      title: "Uprate datalink shielding",
      changeType: "hardware",
      affected: "DATALINK-5",
    },
    {
      title: "Propeller pitch revision",
      changeType: "hardware",
      affected: "PROP-14",
    },
    {
      title: "Thermal core supplier qualification",
      changeType: "sourcing",
      affected: "THERMAL-4",
    },
    {
      title: "Flight-control loop retune",
      changeType: "firmware",
      affected: "IMU-7",
    },
    {
      title: "Landing gear stiffener",
      changeType: "hardware",
      affected: "LANDING-2",
    },
    {
      title: "Battery cell chemistry change",
      changeType: "component",
      affected: "BATT-SMART",
    },
  ],
  compat: {
    hwRevs: ["rev-C", "rev-D", "rev-E"],
    fwVersions: ["fw-4.2.1", "fw-4.3.0", "fw-4.3.2", "fw-4.4.0-rc"],
  },
  certs: [
    { name: "Airworthiness release", scope: "Airframe family" },
    { name: "Export control classification", scope: "All exported units" },
    { name: "EMC / RF compliance", scope: "Datalink + avionics" },
  ],
  deals: [
    { config: "Airframe · 12-unit squadron", value: 1_840_000 },
    { config: "Airframe · evaluation pair", value: 310_000 },
    { config: "Airframe · 24-unit programme", value: 3_620_000 },
    { config: "Sustainment contract · 3yr", value: 940_000 },
    { config: "Airframe · 6-unit trial", value: 720_000 },
    { config: "Training + spares package", value: 265_000 },
    { config: "Airframe · 18-unit follow-on", value: 2_410_000 },
    { config: "Depot tooling package", value: 188_000 },
  ],
  campaigns: [
    { name: "Defense expo presence", channel: "Event" },
    { name: "Range-day demonstrations", channel: "Field" },
    { name: "Programme-office briefings", channel: "Direct" },
    { name: "Endurance benchmark paper", channel: "Content" },
    { name: "Integrator partner programme", channel: "Partner" },
    { name: "Sustainment upsell", channel: "Direct" },
    { name: "Cleared-talent recruiting", channel: "Content" },
  ],
  ledgerAccounts: [
    "Airframe revenue",
    "Sustainment revenue",
    "Materials",
    "Contract manufacturing",
    "Flight test operations",
    "Engineering payroll",
    "Facilities",
    "Certification & compliance",
  ],
  unitEconomics: [
    { product: "Airframe", asp: 152_000, cogs: 94_000, trend: "improving" },
    {
      product: "Sustainment (per unit/yr)",
      asp: 28_000,
      cogs: 12_400,
      trend: "stable",
    },
    { product: "Spares kit", asp: 18_500, cogs: 11_900, trend: "stable" },
    {
      product: "Training package",
      asp: 46_000,
      cogs: 21_000,
      trend: "improving",
    },
  ],
  hiringRoles: [
    "Flight test engineer",
    "Avionics engineer",
    "Composites technician",
    "Programme manager",
    "Quality engineer",
  ],
  obligations: [
    { obligation: "Availability >= 95%", actual: "96.2%" },
    { obligation: "Depot turnaround <= 10d", actual: "8.4d" },
    { obligation: "Spares fill rate >= 90%", actual: "88.1%" },
    { obligation: "Incident report <= 24h", actual: "11h" },
  ],
  exportDestinations: [
    "Partner Nation A",
    "Partner Nation B",
    "Partner Nation C",
    "Partner Nation D",
  ],
  legalMatters: [
    { type: "Contract", title: "Programme framework agreement" },
    { type: "IP", title: "Datalink patent filing" },
    { type: "Compliance", title: "Export licence renewal" },
    { type: "Contract", title: "Sustainment terms amendment" },
    { type: "Dispute", title: "Supplier late-delivery claim" },
  ],
  projects: [
    {
      moduleKey: "procurement",
      name: "Datalink dual-source",
      description: "Qualify a second datalink radio vendor.",
    },
    {
      moduleKey: "engineering",
      name: "Endurance uplift",
      description: "Extend loiter time by 18%.",
    },
    {
      moduleKey: "quality",
      name: "Bond-line void reduction",
      description: "Drive composite voids below 0.5%.",
    },
    {
      moduleKey: "manufacturing",
      name: "Flight-test throughput",
      description: "Cut test-cell queue time.",
    },
    {
      moduleKey: "legal",
      name: "Export licence pack",
      description: "Assemble licence evidence per destination.",
    },
    {
      moduleKey: "sales",
      name: "Programme capture",
      description: "Capture plan for the follow-on buy.",
    },
  ],
  matrixQuestions: [
    "Lead time (days)?",
    "Unit price at qty 50?",
    "Export-control classification?",
    "Second-source available?",
    "Qualification evidence provided?",
  ],
  workflows: [
    {
      moduleKey: "procurement",
      name: "Long-lead reorder",
      description: "Draft a reorder when cover falls under lead time.",
    },
    {
      moduleKey: "quality",
      name: "SPC breach triage",
      description: "Open an NCR when a characteristic breaches UCL.",
    },
    {
      moduleKey: "engineering",
      name: "Change impact sweep",
      description: "Compute blast radius for a proposed change.",
    },
    {
      moduleKey: "field-service",
      name: "Field fault escalation",
      description: "Escalate a repeat field fault to engineering.",
    },
  ],
};

/**
 * WAREHOUSE AUTOMATION — picking cells, not airframes. Same shapes, own vocabulary, so
 * every module screen stays as populated as its mock WITHOUT borrowing another
 * industry's records.
 */
export const WAREHOUSE_PACK: DomainPack = {
  key: "warehouse",
  productNoun: "picking cell",
  productLabel: "Picking cell",
  // Named to sit clearly APART from the module partners a warehouse config names
  // itself (arm / gripper / vision / compute / pneumatics), so the vendor list reads
  // as one roster rather than two overlapping ones.
  suppliers: [
    { name: "Linear Motion Supply", tier: 1, riskScore: 0.34, onTimePct: 93.6 },
    { name: "Depth Optics Ltd", tier: 2, riskScore: 0.19, onTimePct: 98.2 },
    {
      name: "Conveyor Components BV",
      tier: 2,
      riskScore: 0.26,
      onTimePct: 96.4,
    },
    { name: "Safety Systems KK", tier: 1, riskScore: 0.38, onTimePct: 92.1 },
    {
      name: "Frame & Structure Works",
      tier: 3,
      riskScore: 0.15,
      onTimePct: 99.0,
    },
    { name: "Cable Assemblies Inc", tier: 3, riskScore: 0.21, onTimePct: 97.5 },
  ],
  parts: [
    {
      sku: "SUCTION-CUP",
      name: "Vacuum suction cup set",
      onHand: 64,
      reorderPoint: 30,
      leadDays: 12,
    },
    {
      sku: "VAC-PUMP",
      name: "Vacuum pump unit",
      onHand: 11,
      reorderPoint: 8,
      leadDays: 26,
    },
    {
      sku: "CONVEYOR-BELT",
      name: "Cell conveyor belt",
      onHand: 18,
      reorderPoint: 10,
      leadDays: 20,
    },
    {
      sku: "TOTE-SENSOR",
      name: "Tote presence sensor",
      onHand: 47,
      reorderPoint: 20,
      leadDays: 14,
    },
    {
      sku: "BARCODE-SCAN",
      name: "Fixed barcode scanner",
      onHand: 22,
      reorderPoint: 12,
      leadDays: 18,
    },
    {
      sku: "SAFETY-SCAN",
      name: "Safety laser scanner",
      onHand: 9,
      reorderPoint: 8,
      leadDays: 34,
    },
    {
      sku: "LIGHT-CURTAIN",
      name: "Light curtain pair",
      onHand: 14,
      reorderPoint: 8,
      leadDays: 22,
    },
    {
      sku: "ENCODER-J",
      name: "Joint encoder",
      onHand: 28,
      reorderPoint: 15,
      leadDays: 29,
    },
    {
      sku: "GEARBOX-J4",
      name: "Joint gearbox (J4)",
      onHand: 6,
      reorderPoint: 9,
      leadDays: 41,
    },
    {
      sku: "CTRL-CABINET",
      name: "Control cabinet assembly",
      onHand: 8,
      reorderPoint: 5,
      leadDays: 37,
    },
    {
      sku: "PICK-TRAY",
      name: "Pick tray insert",
      onHand: 55,
      reorderPoint: 25,
      leadDays: 11,
    },
    {
      sku: "CABLE-DRAG",
      name: "Drag-chain cable set",
      onHand: 30,
      reorderPoint: 16,
      leadDays: 19,
    },
  ],
  stations: [
    "Base Frame",
    "Arm Assembly",
    "Gripper Fit",
    "Vision Calibration",
    "Cell Integration",
    "Pack-out",
  ],
  spc: {
    characteristic: "pick_cycle_ms",
    unit: "ms",
    ucl: 980,
    lcl: 780,
    mean: 880,
    values: [
      842, 868, 855, 879, 861, 892, 848, 872, 884, 866, 897, 881, 858, 874, 901,
      886, 918, 893, 909, 926, 914, 941, 987, 1003,
    ],
  },
  defects: [
    { defect: "Pick cycle over UCL (gripper servo lag)", severity: "MAJOR" },
    { defect: "Vacuum seal loss on porous items", severity: "MAJOR" },
    { defect: "Barcode misread at tote edge", severity: "MINOR" },
    { defect: "Depth camera calibration drift", severity: "MINOR" },
    { defect: "Safety scanner nuisance trip", severity: "CRITICAL" },
  ],
  customers: [
    "3PL Customer A",
    "Grocery Retailer B",
    "E-comm Retailer C",
    "Parcel Operator D",
  ],
  sites: ["Warsaw DC", "Rotterdam Hub", "Midlands DC", "Lyon Hub"],
  fleet: {
    model: "Picking cell",
    firmwares: ["cell-2.6.4", "cell-2.7.0", "cell-2.7.3"],
    issues: [
      "Gripper servo stall under load",
      "Vacuum pressure below threshold",
      "Vision calibration out of tolerance",
      "Conveyor belt tracking off-centre",
      "Safety scanner requires re-teach",
    ],
    incidentTypes: [
      "Guard-door interlock trip",
      "Emergency stop activation",
      "Tote spill in cell",
      "Pinch-point near miss",
    ],
  },
  ecos: [
    {
      title: "Gripper servo re-source",
      changeType: "sourcing",
      affected: "GEARBOX-J4",
    },
    {
      title: "Suction cup compound change",
      changeType: "component",
      affected: "SUCTION-CUP",
    },
    {
      title: "Vision pipeline retune",
      changeType: "firmware",
      affected: "TOTE-SENSOR",
    },
    {
      title: "Cabinet wiring simplification",
      changeType: "hardware",
      affected: "CTRL-CABINET",
    },
    {
      title: "Safety scanner field revision",
      changeType: "hardware",
      affected: "SAFETY-SCAN",
    },
    {
      title: "Drag-chain routing change",
      changeType: "hardware",
      affected: "CABLE-DRAG",
    },
  ],
  compat: {
    hwRevs: ["cell-rev-3", "cell-rev-4", "cell-rev-5"],
    fwVersions: ["cell-2.6.4", "cell-2.7.0", "cell-2.7.3", "cell-2.8.0-rc"],
  },
  certs: [
    { name: "Machinery safety conformity", scope: "Picking cell family" },
    {
      name: "Functional safety assessment",
      scope: "Safety scanner + interlocks",
    },
    { name: "Electrical installation certificate", scope: "Control cabinet" },
  ],
  deals: [
    { config: "Picking cell · 8-cell rollout", value: 1_240_000 },
    { config: "Picking cell · pilot pair", value: 268_000 },
    { config: "Picking cell · 16-cell programme", value: 2_380_000 },
    { config: "Service contract · 3yr", value: 540_000 },
    { config: "Picking cell · 4-cell trial", value: 620_000 },
    { config: "Spares + training package", value: 148_000 },
    { config: "Picking cell · 12-cell follow-on", value: 1_760_000 },
    { config: "Throughput upgrade kit", value: 96_000 },
  ],
  campaigns: [
    { name: "Intralogistics expo presence", channel: "Event" },
    { name: "Throughput benchmark study", channel: "Content" },
    { name: "3PL operator briefings", channel: "Direct" },
    { name: "Peak-season readiness push", channel: "Email" },
    { name: "Systems-integrator programme", channel: "Partner" },
    { name: "Service-contract upsell", channel: "Direct" },
    { name: "Automation engineer hiring", channel: "Content" },
  ],
  ledgerAccounts: [
    "Cell revenue",
    "Service revenue",
    "Materials",
    "Contract manufacturing",
    "Installation & commissioning",
    "Engineering payroll",
    "Facilities",
    "Safety compliance",
  ],
  unitEconomics: [
    { product: "Picking cell", asp: 138_000, cogs: 86_500, trend: "improving" },
    {
      product: "Service (per cell/yr)",
      asp: 22_000,
      cogs: 9_800,
      trend: "stable",
    },
    { product: "Spares kit", asp: 14_200, cogs: 8_900, trend: "stable" },
    {
      product: "Throughput upgrade",
      asp: 31_000,
      cogs: 16_400,
      trend: "improving",
    },
  ],
  hiringRoles: [
    "Automation engineer",
    "Vision engineer",
    "Field service engineer",
    "Solutions architect",
    "Quality engineer",
  ],
  obligations: [
    { obligation: "Cell uptime >= 98%", actual: "98.6%" },
    { obligation: "Pick rate >= 600/hr", actual: "624/hr" },
    { obligation: "On-site response <= 8h", actual: "6.2h" },
    { obligation: "Spares fill rate >= 92%", actual: "90.4%" },
  ],
  exportDestinations: [
    "EU (intra)",
    "United Kingdom",
    "Switzerland (non-EU)",
    "Norway (non-EU)",
  ],
  legalMatters: [
    { type: "Contract", title: "Rollout master services agreement" },
    { type: "IP", title: "Grasp-planning patent filing" },
    { type: "Compliance", title: "Machinery directive assessment" },
    { type: "Contract", title: "Service-level amendment" },
    { type: "Dispute", title: "Commissioning delay claim" },
  ],
  projects: [
    {
      moduleKey: "procurement",
      name: "Gripper servo dual-source",
      description: "Qualify a second servo vendor for the gripper.",
    },
    {
      moduleKey: "engineering",
      name: "Pick-rate uplift",
      description: "Raise sustained pick rate by 12%.",
    },
    {
      moduleKey: "quality",
      name: "Vacuum seal reliability",
      description: "Cut seal-loss defects on porous items.",
    },
    {
      moduleKey: "manufacturing",
      name: "Cell integration takt",
      description: "Reduce integration station takt time.",
    },
    {
      moduleKey: "legal",
      name: "Machinery conformity pack",
      description: "Assemble conformity evidence per site.",
    },
    {
      moduleKey: "sales",
      name: "Peak-season capture",
      description: "Capture plan for the peak-season rollout.",
    },
  ],
  matrixQuestions: [
    "Lead time (days)?",
    "Unit price at qty 50?",
    "Duty cycle rating?",
    "Second-source available?",
    "Safety certification provided?",
  ],
  workflows: [
    {
      moduleKey: "procurement",
      name: "Long-lead reorder",
      description: "Draft a reorder when cover falls under lead time.",
    },
    {
      moduleKey: "quality",
      name: "SPC breach triage",
      description: "Open an NCR when a characteristic breaches UCL.",
    },
    {
      moduleKey: "engineering",
      name: "Change impact sweep",
      description: "Compute blast radius for a proposed change.",
    },
    {
      moduleKey: "field-service",
      name: "Field fault escalation",
      description: "Escalate a repeat field fault to engineering.",
    },
  ],
};

/** Options every pack-driven seed needs from its caller (the prospect config). */
export interface DomainSeedOpts {
  /** record-code prefix, e.g. "NM" / "DC" — keeps tenants' codes distinct. */
  prefix: string;
  /** anchors relative dates; pass Date.now() from the caller. */
  nowMs: number;
  /** any user in the org (audit/integration rows record an actor). */
  adminUserId: string;
  /** first serial number in this tenant's fleet range. */
  serialBase?: number;
  /**
   * The line's station names, when the config already seeds work orders of its own.
   * Passing them keeps the manufacturing board to ONE set of columns instead of the
   * config's and the pack's side by side. Defaults to `pack.stations`.
   */
  stations?: string[];
}

/** Narrow a db handle without importing Prisma's generated types here. */
export type DomainDb = OrgScopedDb;
