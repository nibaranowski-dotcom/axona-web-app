import * as React from "react";
import { render } from "@react-email/render";
import { getMailer } from "./mailer";
import { InviteEmail, type InviteEmailProps } from "./templates/invite";
import { VerifyEmail, type VerifyEmailProps } from "./templates/verify";
import { ResetEmail, type ResetEmailProps } from "./templates/reset";
import { ReceiptEmail, type ReceiptEmailProps } from "./templates/receipt";

// EMAIL.1 — the send dispatcher. Renders the branded React Email template → sends
// via the DI mailer (Fake in dev/CI, Resend with a key). try/catch: a mailer
// failure NEVER throws into the caller (transactional email is best-effort). The
// caller's business action already committed; the email is a side-effect.

type EmailSpec =
  | { kind: "invite"; props: InviteEmailProps }
  | { kind: "verify"; props: VerifyEmailProps }
  | { kind: "reset"; props: ResetEmailProps }
  | { kind: "receipt"; props: ReceiptEmailProps };

const SUBJECT: Record<EmailSpec["kind"], (p: never) => string> = {
  invite: (p: InviteEmailProps) =>
    `${p.inviterName} invited you to ${p.orgName} on Axona`,
  verify: () => "Verify your Axona email",
  reset: () => "Reset your Axona password",
  receipt: (p: ReceiptEmailProps) => `Your Axona receipt — ${p.amount}`,
} as unknown as Record<EmailSpec["kind"], (p: never) => string>;

export async function renderEmail(spec: EmailSpec): Promise<string> {
  const el =
    spec.kind === "invite"
      ? React.createElement(InviteEmail, spec.props)
      : spec.kind === "verify"
        ? React.createElement(VerifyEmail, spec.props)
        : spec.kind === "reset"
          ? React.createElement(ResetEmail, spec.props)
          : React.createElement(ReceiptEmail, spec.props);
  return render(el, { pretty: false });
}

export async function sendEmail(
  spec: EmailSpec,
  to: string,
): Promise<{ ok: boolean }> {
  try {
    const html = await renderEmail(spec);
    const subject = (SUBJECT[spec.kind] as (p: unknown) => string)(spec.props);
    await getMailer().send({ to, subject, html });
    return { ok: true };
  } catch (err) {
    // Best-effort — log + swallow so the caller's action is unaffected.
    console.error(
      `[sendEmail] ${spec.kind} → ${to} failed:`,
      (err as Error).message,
    );
    return { ok: false };
  }
}
