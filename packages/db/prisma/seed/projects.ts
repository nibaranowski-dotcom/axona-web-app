import type { OrgScopedDb } from "../../src";
import { CODES } from "./constants";

// 14 projects across modules, each with a few files. Files are children of
// Project (no orgId of their own); the matrix columns/embeddings are FILE.2.

type Seed = {
  moduleKey: string;
  name: string;
  description: string;
  status: ProjectStatusStr;
  files: { name: string; ext: string; type: string; linkedTo?: string }[];
};

type ProjectStatusStr = "ACTIVE" | "IN_REVIEW" | "BLOCKED" | "DONE";

const PROJECTS: Seed[] = [
  {
    moduleKey: "engineering",
    name: `${CODES.eco} — torque-comp supersede`,
    description:
      "Change package superseding SERVO-204 with -205 + firmware torque-comp.",
    status: "IN_REVIEW",
    files: [
      {
        name: "ECO-318 change package",
        ext: "pdf",
        type: "Change",
        linkedTo: `Engineering · ${CODES.eco}`,
      },
      {
        name: "Impact analysis — Tier-1 Auto OEM order",
        ext: "docx",
        type: "Report",
        linkedTo: "Sales · Tier-1 Auto OEM",
      },
      {
        name: "SERVO-205 spec",
        ext: "pdf",
        type: "Spec",
        linkedTo: `Engineering · ${CODES.servoNew}`,
      },
    ],
  },
  {
    moduleKey: "quality",
    name: `${CODES.ncr} — actuator torque containment`,
    description:
      "Critical NCR on SERVO-204 torque drift, root-caused to lot 88421.",
    status: "ACTIVE",
    files: [
      {
        name: "NCR-118 record",
        ext: "pdf",
        type: "Report",
        linkedTo: `Quality · ${CODES.ncr}`,
      },
      { name: "SPC torque chart", ext: "csv", type: "Data" },
    ],
  },
  {
    moduleKey: "fulfillment",
    name: `${CODES.delivery} — Tier-1 Auto OEM · Osaka delivery`,
    description: "24× HX-2 to Osaka; EAR99 customs hold.",
    status: "BLOCKED",
    files: [
      {
        name: "DLV-3312 shipment plan",
        ext: "pdf",
        type: "Plan",
        linkedTo: `Fulfillment · ${CODES.delivery}`,
      },
      {
        name: "EAR99 export memo",
        ext: "docx",
        type: "Memo",
        linkedTo: "Legal · export-control",
      },
    ],
  },
  {
    moduleKey: "procurement",
    name: "SERVO-205 re-source",
    description: "Re-sourcing the torque-comp drive after ECO-318.",
    status: "ACTIVE",
    files: [
      { name: "RFQ — SERVO-205", ext: "pdf", type: "Quote" },
      { name: "Supplier quotes — 3 vendors", ext: "xlsx", type: "Data" },
      { name: "Lead-time analysis", ext: "pdf", type: "Report" },
      { name: "Award recommendation", ext: "docx", type: "Memo" },
    ],
  },
  {
    moduleKey: "fleet",
    name: `${CODES.robot} — thermal watch`,
    description: "Predictive-failure watch on SN-2196 (battery thermal).",
    status: "ACTIVE",
    files: [
      {
        name: "Telemetry export SN-2196",
        ext: "csv",
        type: "Data",
        linkedTo: `Fleet · ${CODES.robot}`,
      },
      { name: "Predictive model output", ext: "pdf", type: "Report" },
      { name: "Cell-4 ΔV trend", ext: "csv", type: "Data" },
      { name: "Thermal guard runbook", ext: "md", type: "Memo" },
    ],
  },
  {
    moduleKey: "field-service",
    name: "WO-5521 — battery swap",
    description: "SN-2196 battery swap dispatch under SLA.",
    status: "ACTIVE",
    files: [
      { name: "Work order WO-5521", ext: "pdf", type: "Report" },
      { name: "Osei dispatch sheet", ext: "pdf", type: "Report" },
      { name: "Battery swap procedure", ext: "pdf", type: "Spec" },
      { name: "Site-3 access permit", ext: "docx", type: "Memo" },
    ],
  },
  {
    moduleKey: "autonomy",
    name: `${CODES.policy} canary — Site-3`,
    description: "Autonomy regression after the p-13 canary; INC-201 review.",
    status: "IN_REVIEW",
    files: [
      {
        name: "p-13 canary eval",
        ext: "pdf",
        type: "Report",
        linkedTo: "Autonomy · INC-201",
      },
      { name: "INC-201 incident report", ext: "pdf", type: "Report" },
      { name: "Takeover log Site-3", ext: "csv", type: "Data" },
      { name: "Rollback plan → p-12", ext: "docx", type: "Plan" },
    ],
  },
  {
    moduleKey: "finance",
    name: "HX-2 margin review",
    description: "−2.1pt margin from ECO-318; rev-rec split.",
    status: "ACTIVE",
    files: [
      { name: "Unit economics HX-2", ext: "xlsx", type: "Data" },
      { name: "Rev-rec split memo", ext: "docx", type: "Memo" },
      { name: "ECO-318 cost impact", ext: "xlsx", type: "Data" },
      { name: "Q3 margin bridge", ext: "pdf", type: "Report" },
    ],
  },
  {
    moduleKey: "legal",
    name: "ECO-318 patent + INC-201",
    description: "IP filing for torque-comp; INC-201 liability review.",
    status: "ACTIVE",
    files: [
      {
        name: "Patent draft",
        ext: "docx",
        type: "Memo",
        linkedTo: `Legal · ${CODES.eco}`,
      },
      { name: "INC-201 liability review", ext: "docx", type: "Memo" },
      { name: "Prior-art search", ext: "pdf", type: "Report" },
      { name: "Export-control note", ext: "docx", type: "Memo" },
    ],
  },
  {
    moduleKey: "sales",
    name: "Tier-1 Auto OEM HX-2 ×24",
    description: "Commit-stage deal; deliverability AT_RISK +3w.",
    status: "ACTIVE",
    files: [
      {
        name: "Tier-1 Auto OEM proposal",
        ext: "pdf",
        type: "Quote",
        linkedTo: "Sales · Tier-1 Auto OEM",
      },
      { name: "MSA redlines", ext: "docx", type: "Memo" },
      { name: "Deliverability assessment", ext: "pdf", type: "Report" },
      { name: "Pricing model HX-2 ×24", ext: "xlsx", type: "Data" },
    ],
  },
  {
    moduleKey: "manufacturing",
    name: "HX-2 line ramp",
    description: "Build genealogy + OEE for the HX-2 line.",
    status: "ACTIVE",
    files: [
      { name: "Build genealogy HX2-0418", ext: "csv", type: "Data" },
      { name: "OEE dashboard export", ext: "csv", type: "Data" },
      { name: "Line balance plan", ext: "pdf", type: "Plan" },
      { name: "Station takt study", ext: "xlsx", type: "Data" },
    ],
  },
  {
    moduleKey: "people",
    name: "Field cert matrix",
    description: "Cert expiry gating dispatch (Osei HV/battery −12d).",
    status: "ACTIVE",
    files: [
      { name: "Cert matrix", ext: "xlsx", type: "Data" },
      { name: "Hiring plan vs fleet growth", ext: "xlsx", type: "Data" },
      { name: "Osei recert schedule", ext: "pdf", type: "Plan" },
      { name: "Training records", ext: "pdf", type: "Report" },
    ],
  },
  {
    moduleKey: "security",
    name: "CVE-2026-3187 triage",
    description: "CVE affecting 42 deployed units; signed-firmware patch.",
    status: "ACTIVE",
    files: [
      { name: "CVE triage notes", ext: "md", type: "Memo" },
      { name: "Patch rollout plan", ext: "pdf", type: "Plan" },
      { name: "Affected-units list", ext: "csv", type: "Data" },
      { name: "Signed-firmware attestation", ext: "pdf", type: "Report" },
    ],
  },
  {
    moduleKey: "marketing",
    name: "Q3 channel mix",
    description: "Events dominant; reallocate from underperforming paid.",
    status: "DONE",
    files: [
      { name: "Attribution report", ext: "pdf", type: "Report" },
      { name: "Channel spend model", ext: "xlsx", type: "Data" },
      { name: "Campaign ROI export", ext: "csv", type: "Data" },
      { name: "Q4 plan draft", ext: "docx", type: "Plan" },
    ],
  },
];

// A small human pool so member mixes vary per project (agents + humans).
const HUMANS = [
  "Dana Reyes",
  "Priya Nair",
  "Sam Cole",
  "Lena Frost",
  "Marco Diaz",
  "Ava Lin",
];

export async function seedProjects(db: OrgScopedDb): Promise<number> {
  for (let i = 0; i < PROJECTS.length; i++) {
    const p = PROJECTS[i]!;
    // Vary the member mix: 1–2 agents + 1–3 humans, deterministic by index.
    const agents =
      i % 3 === 0
        ? [`${p.moduleKey}-01`, `${p.moduleKey}-02`]
        : [`${p.moduleKey}-01`];
    const humans = Array.from(
      { length: 1 + (i % 3) },
      (_, k) => HUMANS[(i + k) % HUMANS.length]!,
    );
    const project = await db.project.create({
      data: {
        moduleKey: p.moduleKey,
        name: p.name,
        description: p.description,
        status: p.status,
        members: { humans, agents },
      },
    });
    for (const f of p.files) {
      await db.file.create({
        data: {
          projectId: project.id,
          name: f.name,
          ext: f.ext,
          sizeBytes: 100_000 + f.name.length * 137,
          blobKey: `seed/${project.id}/${f.name.replace(/\s+/g, "_")}.${f.ext}`,
          type: f.type,
          linkedTo: f.linkedTo ?? null,
          extracted: {},
        },
      });
    }
  }
  return PROJECTS.length;
}
