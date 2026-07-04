import { prisma, dbForOrg } from "../client";
import { getObjectBytes } from "../storage";
import { upsertDoc } from "../search/reindex";
import { extractText } from "./extract";
import { getEmbedder, toVectorLiteral, type Embedder } from "./embedder";

// FILE.2 — the extract-embed processor (the BullMQ `file-extract` job body, also
// runnable in-process for the no-Redis upload path + verify). Org-scoped through
// project.orgId (File has no orgId). Idempotent: re-running overwrites cleanly
// (upsert by (type, refId) → no dup SearchDoc). Never throws on one bad file.
//
// /// MEM.1: File.text + File.embedding are the operational-memory capture — the
// memory graph consumes them later; do not build it here.

export const FILE_EXTRACT_QUEUE = "file-extract";

export interface FileExtractJob {
  fileId: string;
  orgId: string;
}
export interface ProcessResult {
  ok: boolean;
  textLen: number;
  embedded: boolean;
  reason?: string;
}

const EMBED_INPUT_CAP = 8_000;

export async function processFile(
  job: FileExtractJob,
  opts?: { embedder?: Embedder },
): Promise<ProcessResult> {
  const { fileId, orgId } = job;
  const db = dbForOrg(orgId);

  // Org-scoped load: File has no orgId, so join through project.orgId.
  const file = await db.file.findFirst({
    where: { id: fileId, project: { orgId } },
    select: {
      id: true,
      projectId: true,
      name: true,
      ext: true,
      type: true,
      blobKey: true,
      linkedTo: true,
    },
  });
  if (!file)
    return { ok: false, textLen: 0, embedded: false, reason: "not in org" };

  let bytes: Buffer;
  try {
    bytes = await getObjectBytes(file.blobKey);
  } catch (e) {
    await db.file.updateMany({
      where: { id: file.id, project: { orgId } },
      data: { text: "" },
    });
    return {
      ok: false,
      textLen: 0,
      embedded: false,
      reason: `blob read: ${(e as Error).message}`,
    };
  }

  const extracted = await extractText(bytes, file.ext);
  const text = extracted.text;

  // 1) File.text (Prisma, org-scoped where).
  await db.file.updateMany({
    where: { id: file.id, project: { orgId } },
    data: { text },
  });

  // 2) embed (skip when there's no text to embed).
  const embedder = opts?.embedder ?? getEmbedder();
  let vector: number[] | null = null;
  if (text.length > 0) {
    const [v] = await embedder.embed([
      `${file.name}\n${text}`.slice(0, EMBED_INPUT_CAP),
    ]);
    vector = v ?? null;
  }

  // 3) File.embedding via raw SQL (pgvector Unsupported — Prisma can't write it).
  //    Org-checked through the project subquery so isolation holds at write time.
  if (vector) {
    const lit = toVectorLiteral(vector);
    await prisma.$executeRaw`
      UPDATE "File" SET embedding = ${lit}::vector
      WHERE id = ${file.id}
        AND "projectId" IN (SELECT id FROM "Project" WHERE "orgId" = ${orgId})`;
  }

  // 4) upsert the FILE SearchDoc (body = a text snippet → FTS matches content).
  const snippet = text ? text.slice(0, 400) : (file.linkedTo ?? file.type);
  await upsertDoc({
    orgId,
    type: "FILE",
    refId: file.id,
    title: file.name,
    subtitle: file.linkedTo ?? file.type,
    body: snippet,
    url: `/projects/${file.projectId}`,
  });

  // 5) the SearchDoc's embedding (raw SQL) so files are FTS- AND vector-searchable.
  if (vector) {
    const lit = toVectorLiteral(vector);
    await prisma.$executeRaw`
      UPDATE "SearchDoc" SET embedding = ${lit}::vector
      WHERE type = 'FILE'::"SearchType" AND "refId" = ${file.id}
        AND ("orgId" = ${orgId})`;
  }

  return {
    ok: extracted.ok,
    textLen: text.length,
    embedded: !!vector,
    reason: extracted.reason,
  };
}
