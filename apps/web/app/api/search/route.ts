import {
  countByType,
  ensureSearchIndexSchema,
  hybridSearch,
  moduleSearch,
  type SearchHit,
  type SearchResult,
  type SearchScope,
} from "@axona/db";
import { getCurrentUser } from "@/lib/session";

// GET /api/search?q=&scope=&limit=  (build-spec §6)
// Org-scoped HYBRID search (FILE.2): FTS ∪ vector — keyword hits keep priority,
// embeddings add recall (files findable by meaning). FTS-only correct when no
// embeddings exist. `counts` stay FTS per-type totals for SRCH.3's scope tabs.
// The org comes from getCurrentUser() (FND.13 stub, TODO AUTH.1).
//
// SRCH.5 — search can NEVER blank out ("Search unavailable"):
//   1. MODULE search is FTS-INDEPENDENT (moduleSearch queries the Module table
//      directly), so typing a module name always surfaces it even if the FTS
//      `tsv` column is degraded/dropped.
//   2. The FTS portion is best-effort: on failure we self-heal the tsv (idempotent
//      ensureSearchIndexSchema — the generated column repopulates) and retry once;
//      if it still fails we DEGRADE to a 200 with whatever we have (at least the
//      module hits) + `degraded: true`. Only a total failure (module search AND
//      FTS both down) returns a 503.

export const dynamic = "force-dynamic";

const SCOPES: readonly SearchScope[] = [
  "ALL",
  "MODULE",
  "AGENT",
  "WORKFLOW",
  "PROJECT",
  "FILE",
  "CHAT",
];

function parseScope(raw: string | null): SearchScope {
  const v = (raw ?? "ALL").toUpperCase();
  return (SCOPES as readonly string[]).includes(v) ? (v as SearchScope) : "ALL";
}

function parseLimit(raw: string | null): number {
  // Absent/blank → default 20 (note: Number(null) === 0, so guard explicitly).
  if (raw === null || raw.trim() === "") return 20;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 20;
  return Math.min(Math.max(Math.trunc(n), 1), 50);
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const scope = parseScope(searchParams.get("scope"));
  const limit = parseLimit(searchParams.get("limit"));

  // Empty / whitespace query → no DB hit.
  if (!q.trim()) {
    return Response.json({
      query: q,
      scope,
      hits: [],
      byType: {},
      counts: { ALL: 0 },
    });
  }

  const user = await getCurrentUser(); // TODO AUTH.1
  if (!user) {
    return Response.json({
      query: q,
      scope,
      hits: [],
      byType: {},
      counts: { ALL: 0 },
    });
  }

  // 1. MODULE search — FTS-INDEPENDENT (direct Module-table query). Always
  //    attempted so a module name surfaces even when the FTS index is degraded.
  let moduleHits: SearchHit[] = [];
  let moduleOk = true;
  try {
    moduleHits = await moduleSearch(user.orgId, q, { scope, limit });
  } catch (err) {
    moduleOk = false;
    console.error("[/api/search] module search failed:", err);
  }

  // 2. FTS (+ vector) portion — best-effort, self-healing. On failure, re-assert
  //    the generated `tsv` column + GIN index (idempotent; the column repopulates
  //    from the stored title/subtitle/body) and retry ONCE. If it still throws we
  //    degrade rather than 503 — the module hits above already stand alone.
  let ftsResult: SearchResult = { hits: [], byType: {} };
  let counts: Record<string, number> = { ALL: 0 };
  let ftsOk = true;
  const runFts = () =>
    Promise.all([
      hybridSearch(user.orgId, q, { scope, limit }),
      countByType(user.orgId, q),
    ]);
  try {
    [ftsResult, counts] = await runFts();
  } catch (err) {
    console.error("[/api/search] FTS failed — self-healing tsv + retry:", err);
    try {
      await ensureSearchIndexSchema();
      [ftsResult, counts] = await runFts();
    } catch (err2) {
      ftsOk = false;
      console.error("[/api/search] FTS still failing after self-heal:", err2);
    }
  }

  // Merge: module hits FIRST (they never fail), then FTS hits, deduped by
  // type:refId so the FTS copy of a module doesn't double it.
  const seen = new Set<string>();
  const hits: SearchHit[] = [];
  for (const h of [...moduleHits, ...ftsResult.hits]) {
    const key = `${h.type}:${h.refId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push(h);
    if (hits.length >= limit) break;
  }
  const byType: Record<string, SearchHit[]> = {};
  for (const h of hits) (byType[h.type] ??= []).push(h);

  // When FTS is down, keep the scope tabs sane by counting the module hits we do
  // have (all other types are unknown → 0). Never let counts blank the module tab.
  if (!ftsOk) {
    const m = moduleHits.length;
    counts = {
      ALL: m,
      MODULE: m,
      AGENT: 0,
      WORKFLOW: 0,
      PROJECT: 0,
      FILE: 0,
      CHAT: 0,
    };
  }

  // Only a TOTAL failure (module search AND FTS both down) is a hard 503; the
  // client shows "Search unavailable" only then. Otherwise 200 (+ degraded flag).
  if (!moduleOk && !ftsOk) {
    return Response.json(
      {
        query: q,
        scope,
        hits: [],
        byType: {},
        counts: { ALL: 0 },
        degraded: true,
        error: "search_failed",
      },
      { status: 503 },
    );
  }

  return Response.json({
    query: q,
    scope,
    hits,
    byType,
    counts,
    degraded: !ftsOk,
  });
}
