/**
 * Verify EMAIL.1 — transactional email (PRD §43). Static checks always run; live
 * checks gated on DATABASE_URL. Runs entirely on the FakeMailer (no key, no send).
 * Self-cleaning. Run: pnpm verify:email-1
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

const root = process.cwd();
const read = (p: string) =>
  existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

async function run(): Promise<void> {
  console.log("\nVerifying EMAIL.1 — transactional email\n");

  // Force FakeMailer for the whole run.
  delete process.env.RESEND_API_KEY;

  // --- static: DI split + templates + wiring ---
  await check(
    "Mailer interface + Fake/Resend split + getMailer() by env",
    () => {
      const m = read("apps/web/lib/email/mailer.ts");
      return (
        /interface Mailer/.test(m) &&
        /class FakeMailer/.test(m) &&
        /class ResendMailer/.test(m) &&
        /RESEND_API_KEY/.test(m) &&
        /key \? new ResendMailer/.test(m)
      );
    },
  );
  await check(
    "four React Email templates exist (invite/verify/reset/receipt)",
    () => {
      return (
        existsSync(join(root, "apps/web/lib/email/templates/invite.tsx")) &&
        existsSync(join(root, "apps/web/lib/email/templates/verify.tsx")) &&
        existsSync(join(root, "apps/web/lib/email/templates/reset.tsx")) &&
        existsSync(join(root, "apps/web/lib/email/templates/receipt.tsx"))
      );
    },
  );
  await check(
    "createInvites wired to sendEmail('invite') + still returns the link",
    () => {
      const inv = read("apps/web/lib/invites.ts");
      return (
        /sendEmail\(/.test(inv) &&
        /kind: "invite"/.test(inv) &&
        /status: "created", link/.test(inv)
      );
    },
  );
  await check(".env.example documents RESEND_API_KEY + EMAIL_FROM", () => {
    const env = read(".env.example");
    return /RESEND_API_KEY=/.test(env) && /EMAIL_FROM=/.test(env);
  });

  // --- runtime: FakeMailer, render, send, failure-swallow ---
  const mailerMod = await import("../../apps/web/lib/email/mailer");
  const {
    getMailer,
    isFakeMailer,
    isResendMailer,
    FAKE_SINK,
    clearFakeSink,
    _resetMailer,
  } = mailerMod;
  const { renderEmail, sendEmail } =
    await import("../../apps/web/lib/email/send");

  await check("getMailer() → FakeMailer without a key", () => {
    _resetMailer();
    delete process.env.RESEND_API_KEY;
    return isFakeMailer(getMailer());
  });
  await check("getMailer() → ResendMailer with a key", () => {
    _resetMailer();
    process.env.RESEND_API_KEY = "re_test_dummy";
    const isResend = isResendMailer(getMailer());
    delete process.env.RESEND_API_KEY;
    _resetMailer();
    return isResend;
  });
  await check(
    "each template renders HTML with the right props (branded, no emoji)",
    async () => {
      const invite = await renderEmail({
        kind: "invite",
        props: {
          inviterName: "Dana Reyes",
          orgName: "Axona",
          role: "OPS",
          acceptUrl: "https://x/invite/tok_abc",
        },
      });
      const verify = await renderEmail({
        kind: "verify",
        props: { verifyUrl: "https://x/verify/v1" },
      });
      const reset = await renderEmail({
        kind: "reset",
        props: { resetUrl: "https://x/reset/r1" },
      });
      const receipt = await renderEmail({
        kind: "receipt",
        props: {
          orgName: "Axona",
          amount: "$4,200.00",
          invoiceUrl: "https://x/inv/1",
        },
      });
      const noEmoji = ![invite, verify, reset, receipt].some((h) =>
        /[\u{1F300}-\u{1FAFF}]/u.test(h),
      );
      return (
        invite.includes("tok_abc") &&
        /axona/i.test(invite) &&
        verify.includes("v1") &&
        reset.includes("r1") &&
        receipt.includes("$4,200.00") &&
        noEmoji
      );
    },
  );
  await check(
    "sendEmail via FakeMailer records the send (to + subject)",
    async () => {
      clearFakeSink();
      const r = await sendEmail(
        { kind: "reset", props: { resetUrl: "https://x/reset/r2" } },
        "user@x.test",
      );
      const rec = FAKE_SINK[FAKE_SINK.length - 1];
      return r.ok && rec?.to === "user@x.test" && /reset/i.test(rec.subject);
    },
  );
  await check("a mailer failure does NOT throw into the caller", async () => {
    // point at a template render that throws by passing a bad spec through render;
    // instead, simulate a throwing mailer by monkeypatching send.
    const m = getMailer();
    const orig = m.send.bind(m);
    (m as { send: unknown }).send = async () => {
      throw new Error("boom");
    };
    const r = await sendEmail(
      { kind: "verify", props: { verifyUrl: "https://x/v" } },
      "user@x.test",
    );
    (m as { send: unknown }).send = orig;
    return r.ok === false; // swallowed → ok:false, no throw
  });

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP live invite-wiring check — DATABASE_URL not set");
    finish();
    return;
  }

  const { prisma } = await import("@axona/db");
  const { createInvites } = await import("../../apps/web/lib/invites");
  const demo = await prisma.org.findFirst({ where: { name: "Axona" } });
  const admin = await prisma.user.findFirst({
    where: { orgId: demo!.id, role: "ADMIN" },
    select: { id: true, name: true },
  });

  await check(
    "createInvites triggers an invite send (FakeMailer) + still returns the link",
    async () => {
      const TAG = "email1-verify@x.test";
      await prisma.invite.deleteMany({ where: { email: TAG } });
      clearFakeSink();
      const res = await createInvites(demo!.id, [{ email: TAG, role: "OPS" }], {
        id: admin!.id,
        label: admin!.name,
      });
      const sent = FAKE_SINK.some(
        (e) => e.to === TAG && /invited you/i.test(e.subject),
      );
      await prisma.invite.deleteMany({ where: { email: TAG } });
      return !!res[0]?.link && sent;
    },
  );

  await prisma.$disconnect();
  finish();
}

function finish(): void {
  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
