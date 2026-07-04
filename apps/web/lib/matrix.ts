import { dbForOrg } from "@axona/db";
import { ColumnAnswer } from "@axona/agents";

// MTX.1 — the file matrix read (files × columns × answers) for MTX.2. Org-scoped
// via project.orgId (MatrixColumn + File have no orgId of their own). Each cell is
// an agent-drafted proposal: value + citation + calibrated confidence. Read-only.

export interface MatrixColumnDef {
  id: string;
  question: string;
}
export interface MatrixCell {
  value: string;
  citation: string;
  confidence: number;
}
export interface MatrixRow {
  fileId: string;
  name: string;
  ext: string;
  sizeBytes: number;
  type: string;
  linkedTo: string | null;
  modifiedAt: Date;
  hasText: boolean;
  answers: Record<string, MatrixCell>; // keyed by columnId
}
export interface ProjectMatrix {
  columns: MatrixColumnDef[];
  rows: MatrixRow[];
}

function parseCell(v: unknown): MatrixCell | null {
  const p = ColumnAnswer.safeParse(v);
  return p.success ? p.data : null;
}

export async function getProjectMatrix(
  orgId: string,
  projectId: string,
): Promise<ProjectMatrix> {
  const db = dbForOrg(orgId);
  // Org guard: MatrixColumn has no orgId/relation of its own — confirm the project
  // belongs to this org (a cross-org projectId → empty matrix).
  const project = await db.project.findFirst({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) return { columns: [], rows: [] };

  const [columns, files] = await Promise.all([
    db.matrixColumn.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      select: { id: true, question: true },
    }),
    db.file.findMany({
      where: { projectId, project: { orgId } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        ext: true,
        sizeBytes: true,
        type: true,
        linkedTo: true,
        modifiedAt: true,
        text: true,
        extracted: true,
      },
    }),
  ]);

  const rows: MatrixRow[] = files.map((f) => {
    const extracted =
      f.extracted &&
      typeof f.extracted === "object" &&
      !Array.isArray(f.extracted)
        ? (f.extracted as Record<string, unknown>)
        : {};
    const answers: Record<string, MatrixCell> = {};
    for (const c of columns) {
      const cell = parseCell(extracted[c.id]);
      if (cell) answers[c.id] = cell;
    }
    return {
      fileId: f.id,
      name: f.name,
      ext: f.ext,
      sizeBytes: f.sizeBytes,
      type: f.type,
      linkedTo: f.linkedTo,
      modifiedAt: f.modifiedAt,
      hasText: !!f.text && f.text.length > 0,
      answers,
    };
  });

  return { columns, rows };
}
