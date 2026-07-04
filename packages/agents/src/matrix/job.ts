import { dbForOrg, Prisma } from "@axona/db";
import type { ModelClient } from "../runtime/model-client";
import { EMPTY_TEXT_ANSWER, extractColumn, type ColumnAnswer } from "./extract";

// MTX.1 — the ask-across-files fan-out (the BullMQ `matrix-extract` job body, also
// runnable in-process for the no-Redis API path + verify/backfill). For every File
// in the project (org-scoped via project.orgId), extract the column's answer from
// File.text and idempotent-merge it into File.extracted[columnId] — never
// clobbering other columns. Promise.allSettled: one bad file never aborts the rest.

export const MATRIX_EXTRACT_QUEUE = "matrix-extract";

export interface MatrixExtractJob {
  projectId: string;
  columnId: string;
  orgId: string;
  question: string;
}
export interface MatrixExtractResult {
  files: number;
  answered: number;
}

function mergeAnswer(
  extracted: unknown,
  columnId: string,
  answer: ColumnAnswer,
): Prisma.InputJsonValue {
  const base =
    extracted && typeof extracted === "object" && !Array.isArray(extracted)
      ? (extracted as Record<string, unknown>)
      : {};
  return { ...base, [columnId]: answer } as Prisma.InputJsonValue;
}

export async function runColumnExtraction(
  job: MatrixExtractJob,
  opts?: { model?: ModelClient },
): Promise<MatrixExtractResult> {
  const { projectId, columnId, orgId, question } = job;
  const db = dbForOrg(orgId);

  // Org-scoped: only the project's files (File has no orgId → join project.orgId).
  const files = await db.file.findMany({
    where: { projectId, project: { orgId } },
    select: { id: true, text: true, extracted: true },
  });

  const results = await Promise.allSettled(
    files.map(async (f) => {
      const answer =
        f.text && f.text.trim().length > 0
          ? await extractColumn(f.text, question, opts)
          : { ...EMPTY_TEXT_ANSWER }; // empty text → explicit low-confidence n/a
      return { id: f.id, extracted: f.extracted, answer };
    }),
  );

  let answered = 0;
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    await db.file.updateMany({
      where: { id: r.value.id, project: { orgId } },
      data: {
        extracted: mergeAnswer(r.value.extracted, columnId, r.value.answer),
      },
    });
    answered++;
  }
  return { files: files.length, answered };
}

/** Remove a column's answers from every File.extracted in the project (org-scoped). */
export async function removeColumnAnswers(
  orgId: string,
  projectId: string,
  columnId: string,
): Promise<void> {
  const db = dbForOrg(orgId);
  const files = await db.file.findMany({
    where: { projectId, project: { orgId } },
    select: { id: true, extracted: true },
  });
  for (const f of files) {
    if (!f.extracted || typeof f.extracted !== "object") continue;
    const rec = { ...(f.extracted as Record<string, unknown>) };
    if (!(columnId in rec)) continue;
    delete rec[columnId];
    await db.file.updateMany({
      where: { id: f.id, project: { orgId } },
      data: { extracted: rec as Prisma.InputJsonValue },
    });
  }
}
