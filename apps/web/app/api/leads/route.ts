import { createLead, hashIp } from "@/lib/leads";
import { parseSubmission } from "@/lib/lead-submission";
import { isAllowedOrigin, corsHeaders } from "@/lib/lead-cors";
import { notifyNewLead } from "@/lib/lead-notify";
import { rateLimit } from "@/lib/rate-limit";

// LEAD.1 — the PUBLIC, unauthenticated contact-sales capture endpoint. The marketing
// site's Contact Sales form POSTs here. Everything else in the app is authed + RBAC'd;
// this one is reachable by anyone, so it is HARDENED and creates a Lead and NOTHING
// else — no User/Org/session/access, no tenant data touched.
//
// Layers, in order: CORS allowlist → rate limit (per-IP + global) → zod validation
// (length-capped) + honeypot + optional captcha → createLead (dedupe) →
// fire-and-forget notify → generic { ok: true }. A generic response is returned for
// spam/honeypot/dedupe too, so nothing about whether an email is known is leaked. The
// pure hardening (CORS decision, validation/honeypot) lives in @/lib/lead-* (tested).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC_OK = { ok: true } as const;

/** Client IP from the proxy chain (Railway/Cloudflare set x-forwarded-for). */
function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip");
}

function json(
  body: unknown,
  status: number,
  headers: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

// CORS preflight.
export function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  if (!isAllowedOrigin(origin)) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  // 1) CORS allowlist — a cross-origin POST from a non-allowlisted origin is rejected.
  if (!isAllowedOrigin(origin)) {
    return json({ ok: false, error: "origin not allowed" }, 403, headers);
  }

  // 2) rate limit — per-IP (hashed) + global. No PII: the key is a hash, never raw IP.
  const ip = clientIp(req);
  const rl = rateLimit(hashIp(ip) ?? "no-ip");
  if (!rl.ok) {
    return json({ ok: false, error: "rate limited" }, 429, {
      ...headers,
      "Retry-After": String(rl.retryAfterSec),
    });
  }

  // 3) parse body
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ ok: false, error: "invalid body" }, 400, headers);
  }

  // 4) validate + honeypot + captcha (pure, tested in @/lib/lead-submission)
  const parsed = parseSubmission(raw);
  if (parsed.kind === "invalid") {
    // Do NOT echo the raw input / PII — just a generic validation error.
    return json({ ok: false, error: "invalid submission" }, 400, headers);
  }
  if (parsed.kind === "captcha") {
    return json({ ok: false, error: "captcha required" }, 400, headers);
  }
  if (parsed.kind === "honeypot") {
    // Silently drop: NO row, generic success so the bot can't tell it was caught.
    return json(GENERIC_OK, 200, headers);
  }
  const data = parsed.data;

  // 5) create the Lead (dedupe within the window) and NOTHING else.
  try {
    const { id } = await createLead({
      name: data.name,
      workEmail: data.workEmail,
      company: data.company,
      role: data.role ?? null,
      fleetSize: data.fleetSize ?? null,
      useCase: data.useCase ?? null,
      message: data.message ?? null,
      consent: data.consent ?? false,
      source: data.source ?? "homepage-contact",
      ip,
    });

    // 6) notify — fire-and-forget; a notify failure NEVER fails capture.
    void notifyNewLead({
      id,
      name: data.name,
      company: data.company,
      workEmail: data.workEmail,
      useCase: data.useCase ?? null,
      source: data.source ?? "homepage-contact",
    }).catch(() => undefined);

    // No PII in logs — id + company only.
    console.log(`[leads] captured lead ${id} (${data.company})`);
    return json(GENERIC_OK, 200, headers);
  } catch (err) {
    console.error("[leads] capture failed:", (err as Error).message);
    return json({ ok: false, error: "could not capture" }, 500, headers);
  }
}
