// LEAD.1 — CORS allowlist for the public /api/leads endpoint. Pure + dependency-free
// (no `@/`) so it is unit-testable in the verify without a server. Cross-origin POSTs
// are accepted ONLY from the marketing origin(s) in MARKETING_ORIGIN (comma-separated;
// default https://axonahq.com). A request with no Origin (non-browser / same-origin,
// e.g. curl or a server call) is not a CORS case and is allowed.

const DEFAULT_ORIGIN = "https://axonahq.com";

const strip = (o: string) => o.trim().replace(/\/+$/, "");

export function allowedOrigins(): string[] {
  return (process.env.MARKETING_ORIGIN ?? DEFAULT_ORIGIN)
    .split(",")
    .map(strip)
    .filter(Boolean);
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true; // no Origin ⇒ not a browser cross-origin request
  return allowedOrigins().includes(strip(origin));
}

/** CORS response headers; echoes the origin only when it is allowlisted. */
export function corsHeaders(origin: string | null): Record<string, string> {
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin && isAllowedOrigin(origin)) {
    h["Access-Control-Allow-Origin"] = strip(origin);
  }
  return h;
}
