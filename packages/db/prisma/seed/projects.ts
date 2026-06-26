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
        name: "Impact analysis — BMW order",
        ext: "docx",
        type: "Report",
        linkedTo: "Sales · BMW",
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
    name: `${CODES.delivery} — BMW Osaka delivery`,
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
    files: [{ name: "RFQ — SERVO-205", ext: "pdf", type: "Quote" }],
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
    ],
  },
  {
    moduleKey: "field-service",
    name: "WO-5521 — battery swap",
    description: "SN-2196 battery swap dispatch under SLA.",
    status: "ACTIVE",
    files: [{ name: "Work order WO-5521", ext: "pdf", type: "Report" }],
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
    ],
  },
  {
    moduleKey: "finance",
    name: "HX-2 margin review",
    description: "−2.1pt margin from ECO-318; rev-rec split.",
    status: "ACTIVE",
    files: [{ name: "Unit economics HX-2", ext: "xlsx", type: "Data" }],
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
    ],
  },
  {
    moduleKey: "sales",
    name: "BMW HX-2 ×24",
    description: "Commit-stage deal; deliverability AT_RISK +3w.",
    status: "ACTIVE",
    files: [
      {
        name: "BMW proposal",
        ext: "pdf",
        type: "Quote",
        linkedTo: "Sales · BMW",
      },
    ],
  },
  {
    moduleKey: "manufacturing",
    name: "HX-2 line ramp",
    description: "Build genealogy + OEE for the HX-2 line.",
    status: "ACTIVE",
    files: [{ name: "Build genealogy HX2-0418", ext: "csv", type: "Data" }],
  },
  {
    moduleKey: "people",
    name: "Field cert matrix",
    description: "Cert expiry gating dispatch (Osei HV/battery −12d).",
    status: "ACTIVE",
    files: [{ name: "Cert matrix", ext: "xlsx", type: "Data" }],
  },
  {
    moduleKey: "security",
    name: "CVE-2026-3187 triage",
    description: "CVE affecting 42 deployed units; signed-firmware patch.",
    status: "ACTIVE",
    files: [{ name: "CVE triage notes", ext: "md", type: "Memo" }],
  },
  {
    moduleKey: "marketing",
    name: "Q3 channel mix",
    description: "Events dominant; reallocate from underperforming paid.",
    status: "DONE",
    files: [{ name: "Attribution report", ext: "pdf", type: "Report" }],
  },
];

export async function seedProjects(db: OrgScopedDb): Promise<number> {
  for (const p of PROJECTS) {
    const project = await db.project.create({
      data: {
        moduleKey: p.moduleKey,
        name: p.name,
        description: p.description,
        status: p.status,
        members: {
          humans: ["Dana Reyes", "Priya Nair"],
          agents: [`${p.moduleKey}-01`],
        },
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
