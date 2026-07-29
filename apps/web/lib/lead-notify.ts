import { prisma } from "@axona/db";
import { notify } from "./notifications";

// LEAD.1 — the pluggable lead-notify seam. On a new lead it (a) writes an in-app
// notification to Axona's internal org (so it shows in the Leads view + the bell),
// (b) if LEAD_NOTIFY_WEBHOOK_URL is set, POSTs a summary (Slack/webhook), and (c)
// leaves a /// NOTIFY-EMAIL seam for Resend (GOLIVE.1) later. Every arm is BEST-EFFORT
// and wrapped: a notify failure must NEVER fail the capture (the Lead is already saved).
//
// No hard dep on Resend — email is a comment seam, not a call.

export interface LeadNotifyInput {
  id: string;
  name: string;
  company: string;
  workEmail: string;
  useCase?: string | null;
  source: string;
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

/** Fire all configured notify channels. Never throws; returns which arms delivered. */
export async function notifyNewLead(
  lead: LeadNotifyInput,
): Promise<{ inApp: boolean; webhook: boolean }> {
  const result = { inApp: false, webhook: false };

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

  // (c) /// NOTIFY-EMAIL — Resend seam (GOLIVE.1). When email is wired, send the
  // sales team a templated alert here (EMAIL_FROM → sales inbox). Left intentionally
  // unbuilt: LEAD.1 has no hard dep on Resend, and capture must not depend on email.

  return result;
}
