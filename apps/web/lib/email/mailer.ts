// EMAIL.1 — the Mailer interface + Fake/Resend split (DI like the ModelClient /
// Embedder). getMailer() returns the FakeMailer when RESEND_API_KEY is unset (dev/
// CI) so everything is testable with no key + no verified domain. Never logs the key.

export interface SendInput {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}
export type SendResult = { id: string } | { skipped: true };

export interface Mailer {
  send(input: SendInput): Promise<SendResult>;
}

export interface RecordedEmail extends SendInput {
  at: number;
}

// FakeMailer — records to a module-level sink; asserts in tests, no network.
class FakeMailer implements Mailer {
  async send(input: SendInput): Promise<SendResult> {
    FAKE_SINK.push({ ...input, at: 0 });
    // eslint-disable-next-line no-console
    console.log(`[FakeMailer] would send "${input.subject}" → ${input.to}`);
    return { skipped: true };
  }
}

// Test/inspection sink (never used in prod path).
export const FAKE_SINK: RecordedEmail[] = [];
export function clearFakeSink(): void {
  FAKE_SINK.length = 0;
}

// ResendMailer — the real provider. Lazy-imports the SDK so CI (no key) never loads it.
class ResendMailer implements Mailer {
  constructor(
    private apiKey: string,
    private from: string,
  ) {}
  async send(input: SendInput): Promise<SendResult> {
    const { Resend } = await import("resend");
    const resend = new Resend(this.apiKey);
    const { data, error } = await resend.emails.send({
      from: this.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      replyTo: input.replyTo,
    });
    if (error) throw new Error(error.message);
    return { id: data?.id ?? "sent" };
  }
}

let singleton: Mailer | null = null;
export function getMailer(): Mailer {
  if (singleton) return singleton;
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Axona <no-reply@axonahq.com>";
  singleton = key ? new ResendMailer(key, from) : new FakeMailer();
  return singleton;
}

// For tests — force a fresh mailer (env may change between checks).
export function _resetMailer(): void {
  singleton = null;
}
export function isFakeMailer(m: Mailer): boolean {
  return m instanceof FakeMailer;
}
export function isResendMailer(m: Mailer): boolean {
  return m instanceof ResendMailer;
}
