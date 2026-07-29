import { z } from "zod";
import { LEAD_LIMITS } from "./leads";

// LEAD.1 — server-side validation + honeypot parse for the public endpoint. Pure (no
// `@/`, no I/O) so the verify unit-tests it directly. Length-capped, declared fields
// only; a filled honeypot (`website`) means a bot. Nothing here writes or logs PII.

const cap = (n: number) => z.string().trim().max(n);
const optCap = (n: number) =>
  z
    .string()
    .trim()
    .max(n)
    .optional()
    .or(z.literal("").transform(() => undefined));

export const LeadSchema = z.object({
  name: cap(LEAD_LIMITS.name).min(1),
  workEmail: z.string().trim().email().max(LEAD_LIMITS.workEmail),
  company: cap(LEAD_LIMITS.company).min(1),
  role: optCap(LEAD_LIMITS.role),
  fleetSize: optCap(LEAD_LIMITS.fleetSize),
  useCase: optCap(LEAD_LIMITS.useCase),
  message: optCap(LEAD_LIMITS.message),
  consent: z.boolean().optional(),
  source: optCap(LEAD_LIMITS.source),
  // honeypot — a hidden field humans never fill. Non-empty ⇒ bot ⇒ silent drop.
  website: z.string().optional(),
  // captcha token — validated only when LEAD_CAPTCHA_ENABLED (seam; provider later).
  captchaToken: z.string().optional(),
});

export type LeadSubmission = z.infer<typeof LeadSchema>;

export type ParsedSubmission =
  | { kind: "ok"; data: LeadSubmission }
  | { kind: "invalid" } // malformed / oversized / missing-required
  | { kind: "honeypot" } // bot: silently drop, generic success, NO row
  | { kind: "captcha" }; // captcha required + missing (only when the flag is on)

/**
 * Validate + classify a raw submission. Order: schema → honeypot → captcha (flagged).
 * Returns a discriminated result so the route maps each to the right response without
 * leaking which case fired (honeypot returns a generic success upstream).
 */
export function parseSubmission(
  raw: unknown,
  captchaEnabled = process.env.LEAD_CAPTCHA_ENABLED === "1",
): ParsedSubmission {
  const parsed = LeadSchema.safeParse(raw);
  if (!parsed.success) return { kind: "invalid" };
  const data = parsed.data;

  if (data.website && data.website.trim().length > 0) {
    return { kind: "honeypot" };
  }
  if (captchaEnabled && !data.captchaToken) {
    return { kind: "captcha" };
  }
  // /// LEAD-CAPTCHA — when a provider is wired, verify data.captchaToken here
  // (hCaptcha/Turnstile server-side) and return { kind: "captcha" } on failure.
  return { kind: "ok", data };
}
