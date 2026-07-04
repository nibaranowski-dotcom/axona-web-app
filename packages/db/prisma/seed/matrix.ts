import type { OrgScopedDb } from "../../src";
import { Prisma } from "../../src";
import { CODES } from "./constants";

// MTX.1 — seed 3 ask-across-files columns on the ECO-318 through-line project with
// per-file agent-drafted answers (value + a real citation from the file + a
// confidence spread incl. a low-confidence "flag for review"), so MTX.2 renders a
// populated matrix out of the box. Each cell is a proposal — NOT approved
// (RBAC.4/AUDIT.3 seams). Idempotent within a full re-seed. No @axona/agents import
// (circular); the plain objects match the ColumnAnswer shape.

type Answer = { value: string; citation: string; confidence: number };
const json = (v: unknown) => v as unknown as Prisma.InputJsonValue;

// question → (file name → answer). Citations quote real spans of the seeded file
// (name / linked-to appear in File.text after the FILE.2 backfill).
const COLUMNS: { question: string; answers: Record<string, Answer> }[] = [
  {
    question: "Cost / spec impact",
    answers: {
      "ECO-318 change package": {
        value:
          "+$140/unit re-cost; supersede SERVO-204 → -205 + firmware torque-comp",
        citation: "ECO-318 change package",
        confidence: 0.86,
      },
      "Impact analysis — BMW order": {
        value: "24× HX-2 slip ~3 weeks; phased delivery proposed",
        citation: "Sales · BMW",
        confidence: 0.72,
      },
      "SERVO-205 spec": {
        value:
          "New rev adds torque-comp; ~21 days of cover once ECO-318 clears",
        citation: "Engineering · SERVO-205",
        confidence: 0.81,
      },
    },
  },
  {
    question: "Agent flag",
    answers: {
      "ECO-318 change package": {
        value: "Route for approval — cost impact exceeds the $100/unit policy",
        citation: "Engineering · ECO-318",
        confidence: 0.34, // LOW — flag for human review
      },
      "Impact analysis — BMW order": {
        value: "Feasibility risk flagged to Sales for the BMW commitment",
        citation: "Sales · BMW",
        confidence: 0.61,
      },
      "SERVO-205 spec": {
        value: "n/a",
        citation: "",
        confidence: 0.15, // LOW — the spec doesn't address an agent action
      },
    },
  },
  {
    question: "Owner",
    answers: {
      "ECO-318 change package": {
        value: "Priya Nair · Engineering",
        citation: "Engineering · ECO-318",
        confidence: 0.78,
      },
      "Impact analysis — BMW order": {
        value: "Dana Reyes · Sales",
        citation: "Sales · BMW",
        confidence: 0.7,
      },
      "SERVO-205 spec": {
        value: "Priya Nair · Engineering",
        citation: "Engineering · SERVO-205",
        confidence: 0.75,
      },
    },
  },
];

export async function seedMatrix(
  db: OrgScopedDb,
): Promise<{ columns: number; cells: number }> {
  const project = await db.project.findFirst({
    where: { name: { contains: CODES.eco } },
    select: { id: true },
  });
  if (!project) return { columns: 0, cells: 0 };
  const owner = await db.user.findFirst({ select: { id: true } });
  const files = await db.file.findMany({
    where: { projectId: project.id },
    select: { id: true, name: true, extracted: true },
  });

  // extracted answers accumulate per file (merge, never clobber).
  const byFile = new Map<string, Record<string, unknown>>();
  for (const f of files) {
    byFile.set(
      f.id,
      f.extracted &&
        typeof f.extracted === "object" &&
        !Array.isArray(f.extracted)
        ? { ...(f.extracted as Record<string, unknown>) }
        : {},
    );
  }

  let cells = 0;
  for (const col of COLUMNS) {
    const column = await db.matrixColumn.create({
      data: {
        projectId: project.id,
        question: col.question,
        createdBy: owner?.id ?? "seed",
      },
    });
    for (const f of files) {
      const answer = col.answers[f.name];
      if (!answer) continue;
      byFile.get(f.id)![column.id] = answer;
      cells++;
    }
  }

  for (const f of files) {
    await db.file.updateMany({
      where: { id: f.id },
      data: { extracted: json(byFile.get(f.id)) },
    });
  }
  return { columns: COLUMNS.length, cells };
}
