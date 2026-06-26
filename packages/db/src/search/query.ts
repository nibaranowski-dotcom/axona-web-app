import { Prisma } from "@prisma/client";
import { prisma } from "../client";

// Org-scoped full-text search over SearchDoc. All user input is parameterized
// (websearch_to_tsquery over a bound value — no string-built tsquery); the
// optional scope clause is composed with Prisma.sql / Prisma.empty (never a raw
// string fragment). Globals (orgId NULL, i.e. Modules) are always included.

export interface SearchHit {
  type: string;
  refId: string;
  title: string;
  subtitle: string | null;
  url: string;
  orgId: string | null;
  rank: number;
}

export interface SearchResult {
  hits: SearchHit[];
  byType: Record<string, SearchHit[]>;
}

const SCOPES = [
  "ALL",
  "MODULE",
  "AGENT",
  "WORKFLOW",
  "PROJECT",
  "FILE",
  "CHAT",
] as const;
export type SearchScope = (typeof SCOPES)[number];

export async function search(
  orgId: string,
  q: string,
  opts: { scope?: SearchScope; limit?: number } = {},
): Promise<SearchResult> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const scope = opts.scope ?? "ALL";
  const term = q.trim();
  if (!term) return { hits: [], byType: {} };

  const tsquery = Prisma.sql`websearch_to_tsquery('english', ${term})`;
  const scopeClause =
    scope === "ALL"
      ? Prisma.empty
      : Prisma.sql`AND "type" = ${scope}::"SearchType"`;

  const rows = await prisma.$queryRaw<SearchHit[]>`
    SELECT "type", "refId", "title", "subtitle", "url", "orgId",
           ts_rank("tsv", ${tsquery}) AS rank
    FROM "SearchDoc"
    WHERE "tsv" @@ ${tsquery}
      AND ("orgId" = ${orgId} OR "orgId" IS NULL)
      ${scopeClause}
    ORDER BY rank DESC
    LIMIT ${limit};
  `;

  const byType: Record<string, SearchHit[]> = {};
  for (const r of rows) (byType[r.type] ??= []).push(r);
  return { hits: rows, byType };
}

/**
 * Per-type total match counts for a query, IGNORING scope + limit, so scope tabs
 * (All (n) / Agents (n) / Modules (n) …) show live totals. Same org scoping +
 * parameterized tsquery as `search`. Returns every SearchType (0 when none) plus
 * an `ALL` grand total.
 */
export async function countByType(
  orgId: string,
  q: string,
): Promise<Record<string, number>> {
  const perType: Record<string, number> = {
    MODULE: 0,
    AGENT: 0,
    WORKFLOW: 0,
    PROJECT: 0,
    FILE: 0,
    CHAT: 0,
  };
  const term = q.trim();
  if (!term) return { ALL: 0, ...perType };

  const tsquery = Prisma.sql`websearch_to_tsquery('english', ${term})`;
  const rows = await prisma.$queryRaw<Array<{ type: string; n: bigint }>>`
    SELECT "type", count(*) AS n
    FROM "SearchDoc"
    WHERE "tsv" @@ ${tsquery}
      AND ("orgId" = ${orgId} OR "orgId" IS NULL)
    GROUP BY "type";
  `;
  let all = 0;
  for (const r of rows) {
    const n = Number(r.n);
    perType[r.type] = n;
    all += n;
  }
  return { ALL: all, ...perType };
}

/**
 * Semantic (vector) search — dormant until FILE.2 populates `SearchDoc.embedding`.
 * Returns [] today; no error. The column + HNSW index already exist.
 * TODO FILE.2: embed the query, `ORDER BY embedding <=> $1`, fuse with FTS rank.
 */
export async function semanticSearch(
  _orgId: string,
  _q: string,
): Promise<SearchHit[]> {
  return [];
}
