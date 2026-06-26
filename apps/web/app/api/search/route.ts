import { countByType, search, type SearchScope } from "@axona/db";
import { getCurrentUser } from "@/lib/session";

// GET /api/search?q=&scope=&limit=  (build-spec §6)
// Org-scoped FTS. `counts` are per-type totals across ALL types (ignoring scope
// + limit) so SRCH.3's scope tabs can show live counts. No auth gate yet — the
// org comes from getCurrentUser() (FND.13 stub, TODO AUTH.1); RBAC.2 adds gating.

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

  const [result, counts] = await Promise.all([
    search(user.orgId, q, { scope, limit }),
    countByType(user.orgId, q),
  ]);

  return Response.json({
    query: q,
    scope,
    hits: result.hits,
    byType: result.byType,
    counts,
  });
}
