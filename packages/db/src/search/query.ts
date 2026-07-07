import { prisma } from "../client";
import { getEmbedder, toVectorLiteral, type Embedder } from "../embed/embedder";

// Org-scoped full-text search over SearchDoc. All user input is parameterized
// (websearch_to_tsquery over a bound value — no string-built tsquery). SRCH.6: the
// query uses ONLY plain-value binds — NO `Prisma.sql` / `Prisma.empty` fragments
// (those break under Next's duplicate @prisma/client bundle → 42601 `$N` errors);
// scope is a nullable bound value (NULL ⇒ all). Globals (orgId NULL, i.e. Modules)
// are always included.

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

  // SRCH.6 — the 42601 `syntax error at or near "$N"` root cause: interpolating a
  // `Prisma.sql` / `Prisma.empty` FRAGMENT (the old `scopeClause`) into `$queryRaw`.
  // Next.js bundles a second copy of `@prisma/client`, so a fragment built here in
  // @axona/db isn't recognised by the bundled `$queryRaw` — instead of expanding, it
  // gets mis-bound as a stray placeholder, shifting `$N` and breaking the SQL. (tsx,
  // with a single Prisma instance, never hit it — only the bundled server did.)
  // Fix: NO fragments — every interpolation is a plain value. The scope is bound as a
  // nullable value (NULL ⇒ ALL, no filter); the tsquery is evaluated once in a CTE
  // and both the rank + `@@` sites reference it. Keep `SearchScope` typing at the
  // boundary; cast the bound text to the enum in SQL.
  const scopeParam: string | null = scope === "ALL" ? null : scope;
  const rows = await prisma.$queryRaw<SearchHit[]>`
    WITH q AS (
      SELECT websearch_to_tsquery('english', ${term}) AS tsq,
             ${scopeParam}::text AS scope
    )
    SELECT "type", "refId", "title", "subtitle", "url", "orgId",
           ts_rank("tsv", q.tsq) AS rank
    FROM "SearchDoc", q
    WHERE "tsv" @@ q.tsq
      AND ("orgId" = ${orgId} OR "orgId" IS NULL)
      AND (q.scope IS NULL OR "type" = q.scope::"SearchType")
    ORDER BY rank DESC
    LIMIT ${limit};
  `;

  const byType: Record<string, SearchHit[]> = {};
  for (const r of rows) (byType[r.type] ??= []).push(r);
  return { hits: rows, byType };
}

/**
 * SRCH.5 — module search that does NOT depend on the FTS index. Queries the
 * `Module` table directly (case-insensitive ILIKE on name/key), so typing a
 * module name ALWAYS surfaces the module even when `SearchDoc.tsv` is degraded or
 * dropped (the recurring "Search unavailable" regression). Modules are global
 * (orgId NULL); `orgId` is accepted for signature parity + future scoping. Only
 * runs for ALL / MODULE scopes (module rows are irrelevant to the other scopes).
 * Prefix matches rank above mid-string matches so "pro" keeps Procurement on top.
 */
export async function moduleSearch(
  _orgId: string,
  q: string,
  opts: { scope?: SearchScope; limit?: number } = {},
): Promise<SearchHit[]> {
  const scope = opts.scope ?? "ALL";
  if (scope !== "ALL" && scope !== "MODULE") return [];
  const term = q.trim();
  if (!term) return [];
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);

  const rows = await prisma.module.findMany({
    where: {
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { key: { contains: term, mode: "insensitive" } },
      ],
    },
    orderBy: { orderIndex: "asc" },
    take: limit,
  });

  const lower = term.toLowerCase();
  return rows.map((m) => ({
    type: "MODULE",
    refId: m.key,
    title: m.name,
    subtitle: m.group,
    url: `/${m.key}`,
    orgId: null,
    rank:
      m.name.toLowerCase().startsWith(lower) ||
      m.key.toLowerCase().startsWith(lower)
        ? 1
        : 0.6,
  }));
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

  // SRCH.6 — inline the tsquery (plain-value bind); no `Prisma.sql` fragment (which
  // breaks under Next's duplicate @prisma/client — see search()).
  const rows = await prisma.$queryRaw<Array<{ type: string; n: bigint }>>`
    SELECT "type", count(*) AS n
    FROM "SearchDoc"
    WHERE "tsv" @@ websearch_to_tsquery('english', ${term})
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
/**
 * FILE.2 — semantic (vector) search over SearchDoc embeddings. Embeds the query
 * with the DI embedder (FakeEmbedder offline/CI), then ranks by cosine distance
 * (`<=>`). Org-filtered (or NULL globals) so a tenant's vectors never surface to
 * another. Returns [] when no embeddings exist yet (search stays FTS-correct).
 */
export async function semanticSearch(
  orgId: string,
  q: string,
  opts: { limit?: number; embedder?: Embedder } = {},
): Promise<SearchHit[]> {
  const term = q.trim();
  if (!term) return [];
  const embedder = opts.embedder ?? getEmbedder();
  const [qvec] = await embedder.embed([term]);
  if (!qvec) return [];
  const lit = toVectorLiteral(qvec);
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  // SRCH.6 — bind the query vector ONCE via a CTE (it's used by both the rank
  // expression and the ORDER BY). Same parameter-placement hardening as search().
  return prisma.$queryRaw<SearchHit[]>`
    WITH v AS (SELECT ${lit}::vector AS qv)
    SELECT "type", "refId", "title", "subtitle", "url", "orgId",
           (1 - (embedding <=> v.qv))::float8 AS rank
    FROM "SearchDoc", v
    WHERE embedding IS NOT NULL
      AND ("orgId" = ${orgId} OR "orgId" IS NULL)
    ORDER BY embedding <=> v.qv
    LIMIT ${limit};
  `;
}

/**
 * FILE.2 hybrid — FTS ∪ vector. FTS hits keep priority (exact keyword wins);
 * vector hits add recall (files findable by meaning). Deduped by (type, refId).
 * FTS-only correct when no embeddings exist. Scope-aware: vector recall runs for
 * ALL / FILE scopes (where embedded docs live).
 */
export async function hybridSearch(
  orgId: string,
  q: string,
  opts: { scope?: SearchScope; limit?: number; embedder?: Embedder } = {},
): Promise<SearchResult> {
  const scope = opts.scope ?? "ALL";
  const limit = opts.limit ?? 20;
  const fts = await search(orgId, q, { scope, limit });

  const wantsVector = scope === "ALL" || scope === "FILE";
  if (!wantsVector) return fts;

  let vec: SearchHit[] = [];
  try {
    vec = await semanticSearch(orgId, q, { limit, embedder: opts.embedder });
  } catch {
    vec = []; // vector recall is best-effort; never break FTS
  }
  if (scope === "FILE") vec = vec.filter((h) => h.type === "FILE");

  const seen = new Set(fts.hits.map((h) => `${h.type}:${h.refId}`));
  const hits = [...fts.hits];
  for (const h of vec) {
    const key = `${h.type}:${h.refId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push(h);
    if (hits.length >= limit) break;
  }

  const byType: Record<string, SearchHit[]> = {};
  for (const h of hits) (byType[h.type] ??= []).push(h);
  return { hits, byType };
}
