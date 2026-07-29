import { prisma } from "@axona/db";
import { notify } from "./notifications";
import { getMailer, type Mailer } from "./email/mailer";
// Email HTML needs literal colors (email clients don't support CSS vars) — reuse the
// shared email palette (defined in the token-exempt templates layout), not raw hex.
import { emailStyles } from "./email/templates/layout";

// LEAD.1 + GOLIVE.1 — the pluggable lead-notify seam. On a new lead it (a) writes an
// in-app notification to Axona's internal org (so it shows in the Leads view + the
// bell), (b) if LEAD_NOTIFY_WEBHOOK_URL is set, POSTs a summary (Slack/webhook), and
// (c) GOLIVE.1: if RESEND_API_KEY + LEAD_NOTIFY_EMAIL are set, sends a notification
// email via the app's shared Resend mailer (FROM EMAIL_FROM, TO LEAD_NOTIFY_EMAIL,
// replyTo = the lead's work email). Every arm is BEST-EFFORT and wrapped: a notify
// failure — or an unset RESEND_API_KEY/LEAD_NOTIFY_EMAIL — must NEVER fail the capture
// (the Lead is already saved). Reuses getMailer() (no new client, no hard dep).

export interface LeadNotifyInput {
  id: string;
  name: string;
  company: string;
  workEmail: string;
  role?: string | null;
  fleetSize?: string | null;
  message?: string | null;
  useCase?: string | null;
  source: string;
}

const esc = (s: string) =>
  s.replace(/[<>&"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : "&quot;",
  );

/** A plain, internal HTML summary of the lead for the sales alert email. */
function leadEmailHtml(lead: LeadNotifyInput): string {
  const { ink, muted } = emailStyles;
  const row = (label: string, value: string | null | undefined) =>
    value
      ? `<tr><td style="padding:2px 12px 2px 0;color:${muted}">${label}</td><td>${esc(value)}</td></tr>`
      : "";
  return [
    `<div style="font-family:system-ui,sans-serif;font-size:14px;color:${ink}">`,
    `<p style="font-size:15px;font-weight:600;margin:0 0 12px">New sales lead — ${esc(lead.company)}</p>`,
    `<table style="border-collapse:collapse;font-size:13.5px">`,
    row("Name", lead.name),
    row("Company", lead.company),
    row("Work email", lead.workEmail),
    row("Role", lead.role),
    row("Fleet size", lead.fleetSize),
    row("Message", lead.message ?? lead.useCase),
    row("Source", lead.source),
    `</table>`,
    `<p style="margin:14px 0 0;color:${muted};font-size:12.5px">Reply to this email to reach ${esc(lead.name)} directly.</p>`,
    `</div>`,
  ].join("");
}

/**
 * Resolve the Axona-INTERNAL org whose admins triage leads. `LEAD_INTERNAL_ORG_ID`
 * pins it explicitly; otherwise the oldest org (the primary/owner org in a single-
 * tenant deploy). Returns null if there is no org yet (in-app notification is skipped).
 */
async function internalOrgId(): Promise<string | null> {
  const pinned = process.env.LEAD_INTERNAL_ORG_ID;
  if (pinned) return pinned;
  const first = await prisma.org.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return first?.id ?? null;
}

/** Fire all configured notify channels. Never throws; returns which arms delivered.
 *  `opts.mailer` injects a mailer for tests; production uses the shared getMailer(). */
export async function notifyNewLead(
  lead: LeadNotifyInput,
  opts?: { mailer?: Mailer },
): Promise<{ inApp: boolean; webhook: boolean; email: boolean }> {
  const result = { inApp: false, webhook: false, email: false };

  // (a) in-app notification — an org broadcast to the internal org's members.
  try {
    const orgId = await internalOrgId();
    if (orgId) {
      await notify({
        orgId,
        userId: null, // broadcast (the Leads view itself is RBAC-gated to admins)
        type: "SYSTEM",
        title: "New sales lead",
        body: `${lead.company} — ${lead.name}${lead.useCase ? ` · ${lead.useCase}` : ""}`,
        target: { type: "Lead", id: lead.id },
        url: "/leads",
      });
      result.inApp = true;
    }
  } catch (err) {
    // best-effort — the lead is already captured.
    console.error(
      "[lead-notify] in-app notification failed:",
      (err as Error).message,
    );
  }

  // (b) webhook summary — only if configured. Best-effort with a short timeout.
  const webhookUrl = process.env.LEAD_NOTIFY_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: `New Axona sales lead: ${lead.company} — ${lead.name} <${lead.workEmail}>${lead.useCase ? ` · ${lead.useCase}` : ""} (via ${lead.source})`,
          lead: {
            id: lead.id,
            company: lead.company,
            name: lead.name,
            workEmail: lead.workEmail,
            useCase: lead.useCase ?? null,
            source: lead.source,
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      result.webhook = res.ok;
    } catch (err) {
      // a failing/slow webhook must NOT fail capture.
      console.error("[lead-notify] webhook failed:", (err as Error).message);
    }
  }

  // (c) GOLIVE.1 — notification email via the shared Resend mailer. Only when BOTH
  // RESEND_API_KEY (email is wired) and LEAD_NOTIFY_EMAIL (a destination) are set;
  // otherwise skip entirely (send nothing). FROM = EMAIL_FROM (getMailer), TO =
  // LEAD_NOTIFY_EMAIL, replyTo = the lead's work email so a reply reaches them.
  // Best-effort — a send failure never fails the capture.
  const emailTo = process.env.LEAD_NOTIFY_EMAIL;
  if (process.env.RESEND_API_KEY && emailTo) {
    try {
      const mailer = opts?.mailer ?? getMailer();
      await mailer.send({
        to: emailTo,
        subject: `New sales lead: ${lead.company} — ${lead.name}`,
        html: leadEmailHtml(lead),
        replyTo: lead.workEmail,
      });
      result.email = true;
    } catch (err) {
      console.error("[lead-notify] email failed:", (err as Error).message);
    }
  }

  return result;
}
