/**
 * Verify GOLIVE.1 — wire Resend (LEAD.1 notify-email + auth emails).
 * Run: pnpm verify:golive-1
 *
 *   1. LEAD.1 NOTIFY-EMAIL: with RESEND_API_KEY + LEAD_NOTIFY_EMAIL set (mocked mailer),
 *      a new lead triggers EXACTLY ONE notification email to LEAD_NOTIFY_EMAIL with
 *      replyTo = the lead's work email, summarizing the lead.
 *   2. Unset-safe: with RESEND_API_KEY (or LEAD_NOTIFY_EMAIL) UNSET → sends nothing;
 *      and a THROWING mailer never fails the capture (best-effort contract).
 *   3. Auth emails use EMAIL_FROM: getMailer() builds the ResendMailer FROM EMAIL_FROM
 *      when the key is present; FakeMailer when unset. Reuses the existing mailer.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;
const check = async (
  label: string,
  fn: () => boolean | Promise<boolean>,
): Promise<void> => {
  try {
    const ok = await fn();
    console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
    ok ? passed++ : failed++;
  } catch (e) {
    console.log(`  FAIL ${label} — ${(e as Error).message}`);
    failed++;
  }
};

async function run(): Promise<void> {
  console.log(
    "\nVerifying GOLIVE.1 — Resend wiring (LEAD.1 notify-email + auth)\n",
  );
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const notifyLib = read("apps/web/lib/lead-notify.ts");
  const mailer = read("apps/web/lib/email/mailer.ts");
  const send = read("apps/web/lib/email/send.ts");
  const route = read("apps/web/app/api/leads/route.ts");

  // ── static: the email arm reuses the shared mailer; gated + best-effort; from=EMAIL_FROM ──
  await check(
    "lead-notify implements NOTIFY-EMAIL via getMailer() (shared client, no new one)",
    () => {
      return (
        /getMailer/.test(notifyLib) &&
        !/new Resend\(/.test(notifyLib) && // does NOT construct its own client
        /LEAD_NOTIFY_EMAIL/.test(notifyLib) &&
        /RESEND_API_KEY/.test(notifyLib)
      );
    },
  );
  await check(
    "email arm is gated (key + destination), best-effort (try/catch), replyTo = lead email",
    () => {
      return (
        /process\.env\.RESEND_API_KEY && emailTo/.test(notifyLib) &&
        /replyTo: lead\.workEmail/.test(notifyLib) &&
        /\[lead-notify\] email failed/.test(notifyLib) // caught, never rethrown
      );
    },
  );
  await check(
    "the route fires notify fire-and-forget (never blocks capture)",
    () => {
      return /void notifyNewLead\(/.test(route) && /\.catch\(/.test(route);
    },
  );
  await check(
    "auth mailer from = EMAIL_FROM; fallback on the verified send domain",
    () => {
      return (
        /process\.env\.EMAIL_FROM/.test(mailer) &&
        /send\.axonahq\.com/.test(mailer) &&
        /from: this\.from/.test(mailer) && // ResendMailer sends FROM the configured from
        /sendEmail/.test(send) // auth flows dispatch through the shared sender
      );
    },
  );

  // ── functional (mocked mailer — no network, no key) ──
  const { notifyNewLead } = await import("../../apps/web/lib/lead-notify");
  const { getMailer, _resetMailer, isResendMailer, isFakeMailer } =
    await import("../../apps/web/lib/email/mailer");
  type SendInput = {
    to: string;
    subject: string;
    html: string;
    replyTo?: string;
  };
  type Mailer = { send(i: SendInput): Promise<{ id: string }> };

  // snapshot env we mutate
  const snap = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    LEAD_NOTIFY_EMAIL: process.env.LEAD_NOTIFY_EMAIL,
    EMAIL_FROM: process.env.EMAIL_FROM,
    LEAD_NOTIFY_WEBHOOK_URL: process.env.LEAD_NOTIFY_WEBHOOK_URL,
  };
  delete process.env.LEAD_NOTIFY_WEBHOOK_URL; // isolate the email arm from the webhook arm

  const lead = {
    id: "golive1-lead",
    name: "Priya Anand",
    company: "Meridian Humanoids",
    workEmail: "priya@meridian.test",
    role: "VP Operations",
    fleetSize: "50–200",
    message: "Long-lead actuator sourcing is hurting our build schedule.",
    source: "partner",
  };

  const dbUp = !!process.env.DATABASE_URL;
  if (!dbUp) {
    // notifyNewLead's in-app arm touches the DB; without it, that arm no-ops (caught).
    console.log(
      "  NOTE — DATABASE_URL unset: in-app arm is a no-op; email arm still tested.",
    );
  }

  await check(
    "NOTIFY-EMAIL: key + LEAD_NOTIFY_EMAIL set → exactly ONE email to LEAD_NOTIFY_EMAIL, replyTo = lead",
    async () => {
      const sent: SendInput[] = [];
      const mock: Mailer = {
        async send(i) {
          sent.push(i);
          return { id: "mock" };
        },
      };
      process.env.RESEND_API_KEY = "re_test_key";
      process.env.LEAD_NOTIFY_EMAIL = "sales@axona.test";
      const r = await notifyNewLead(lead, { mailer: mock });
      const ok =
        r.email === true &&
        sent.length === 1 &&
        sent[0]!.to === "sales@axona.test" &&
        sent[0]!.replyTo === "priya@meridian.test" &&
        /Meridian Humanoids/.test(sent[0]!.subject) &&
        /VP Operations/.test(sent[0]!.html) && // role in the summary
        /actuator sourcing/i.test(sent[0]!.html); // message in the summary
      return ok;
    },
  );

  await check(
    "unset-safe: RESEND_API_KEY unset → NO email; LEAD_NOTIFY_EMAIL unset → NO email",
    async () => {
      const sentA: SendInput[] = [];
      const mockA: Mailer = {
        async send(i) {
          sentA.push(i);
          return { id: "x" };
        },
      };
      delete process.env.RESEND_API_KEY;
      process.env.LEAD_NOTIFY_EMAIL = "sales@axona.test";
      const rA = await notifyNewLead(lead, { mailer: mockA });

      const sentB: SendInput[] = [];
      const mockB: Mailer = {
        async send(i) {
          sentB.push(i);
          return { id: "x" };
        },
      };
      process.env.RESEND_API_KEY = "re_test_key";
      delete process.env.LEAD_NOTIFY_EMAIL;
      const rB = await notifyNewLead(lead, { mailer: mockB });

      return (
        sentA.length === 0 &&
        rA.email === false &&
        sentB.length === 0 &&
        rB.email === false
      );
    },
  );

  await check(
    "best-effort: a THROWING mailer never fails the capture (notifyNewLead resolves)",
    async () => {
      const throwing: Mailer = {
        async send() {
          throw new Error("resend down");
        },
      };
      process.env.RESEND_API_KEY = "re_test_key";
      process.env.LEAD_NOTIFY_EMAIL = "sales@axona.test";
      // must RESOLVE (not reject) with email:false — the lead is already captured.
      const r = await notifyNewLead(lead, { mailer: throwing });
      return r.email === false;
    },
  );

  await check(
    "auth emails use EMAIL_FROM: key set → ResendMailer(from=EMAIL_FROM); no key → FakeMailer",
    () => {
      process.env.EMAIL_FROM = "Axona <sales@send.axonahq.com>";
      process.env.RESEND_API_KEY = "re_test_key";
      _resetMailer();
      const withKey = isResendMailer(getMailer());
      delete process.env.RESEND_API_KEY;
      _resetMailer();
      const withoutKey = isFakeMailer(getMailer());
      return withKey && withoutKey;
    },
  );

  // ── self-clean: restore env + mailer singleton; drop any Lead in-app notifications ──
  for (const [k, v] of Object.entries(snap)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  _resetMailer();
  if (dbUp) {
    const { prisma } = await import("@axona/db");
    await prisma.notification.deleteMany({ where: { targetType: "Lead" } });
    await prisma.$disconnect();
  }

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run().then(() => process.exit(failed > 0 ? 1 : 0));
