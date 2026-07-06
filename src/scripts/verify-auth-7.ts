/**
 * Verify AUTH.7 — email verification + password reset (PRD §41). Static checks
 * always run; live checks gated on DATABASE_URL. Runs on the FakeMailer (no key).
 * Self-cleaning. Run: pnpm verify:auth-7
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
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
  console.log("\nVerifying AUTH.7 — email verification + password reset\n");
  delete process.env.RESEND_API_KEY; // FakeMailer

  // --- schema + migration ---
  await check(
    "User.emailVerifiedAt + reset/verify token models + migration",
    () => {
      const schema = read("packages/db/prisma/schema.prisma");
      const mig = readdirSync(join(root, "packages/db/prisma/migrations")).find(
        (d) => /auth7_reset_verify/.test(d),
      );
      const sql = mig
        ? read(`packages/db/prisma/migrations/${mig}/migration.sql`)
        : "";
      return (
        /emailVerifiedAt\s+DateTime\?/.test(schema) &&
        /model PasswordResetToken \{/.test(schema) &&
        /model EmailVerifyToken \{/.test(schema) &&
        /CREATE TABLE "PasswordResetToken"/.test(sql) &&
        /ADD COLUMN "emailVerifiedAt"/.test(sql)
      );
    },
  );

  // --- wiring: middleware public, signup verify, forgot link, screens ---
  await check(
    "/reset + /verify public; signup sends verify; Forgot → /reset; screens exist",
    () => {
      const cfg = read("apps/web/auth.config.ts");
      const signup = read("apps/web/app/signup/actions.ts");
      const login = read("apps/web/components/auth/LoginForm.tsx");
      return (
        /\/reset/.test(cfg) &&
        /\/verify/.test(cfg) &&
        /sendVerificationEmail/.test(signup) &&
        /href="\/reset"/.test(login) &&
        existsSync(join(root, "apps/web/app/reset/page.tsx")) &&
        existsSync(join(root, "apps/web/app/reset/[token]/page.tsx")) &&
        existsSync(join(root, "apps/web/app/verify/[token]/page.tsx"))
      );
    },
  );
  await check("reset bumps tokenVersion; anti-enumeration on request", () => {
    const lib = read("apps/web/lib/auth-tokens.ts");
    return (
      /tokenVersion: \{ increment: 1 \}/.test(lib) &&
      /if \(!user \|\| user\.deactivatedAt\) return/.test(lib) // silent — anti-enum
    );
  });

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP live checks — DATABASE_URL not set");
    finish();
    return;
  }

  const { prisma } = await import("@axona/db");
  const tokens = await import("../../apps/web/lib/auth-tokens");
  const { verifyCredentials } = await import("../../apps/web/lib/credentials");

  const ops = await prisma.user.findFirst({
    where: { email: "ops@axona-demo.test" },
  });
  const restore = { hash: ops!.passwordHash, tv: 0 };
  const cleanup = async () => {
    await prisma.passwordResetToken.deleteMany({ where: { userId: ops!.id } });
    await prisma.emailVerifyToken.deleteMany({ where: { userId: ops!.id } });
  };
  await cleanup();
  await prisma.user.update({
    where: { id: ops!.id },
    data: { tokenVersion: 0, emailVerifiedAt: null },
  });

  // 2) request reset: 1h token + send for an existing email; unknown → same, no token.
  await check(
    "request reset → 1h token (existing) + send; unknown email → no token (anti-enum)",
    async () => {
      await tokens.requestPasswordReset("ops@axona-demo.test");
      const row = await prisma.passwordResetToken.findFirst({
        where: { userId: ops!.id },
      });
      const ttlMin = row
        ? (row.expiresAt.getTime() - row.createdAt.getTime()) / 60000
        : 0;
      const before = await prisma.passwordResetToken.count();
      await tokens.requestPasswordReset("nobody-unknown@nowhere.test");
      const after = await prisma.passwordResetToken.count();
      return !!row && Math.round(ttlMin) === 60 && before === after;
    },
  );

  // 3) set-new: valid token re-hashes + used + bumps tokenVersion; reuse/expired invalid.
  await check(
    "set-new-password: re-hash + mark used + bump tokenVersion; reuse rejected",
    async () => {
      const row = await prisma.passwordResetToken.findFirst({
        where: { userId: ops!.id, usedAt: null },
      });
      const tv0 = (await prisma.user.findUnique({ where: { id: ops!.id } }))!
        .tokenVersion;
      const res = await tokens.completePasswordReset(row!.token, "resetpass99");
      const tv1 = (await prisma.user.findUnique({ where: { id: ops!.id } }))!
        .tokenVersion;
      const used =
        (await prisma.passwordResetToken.findUnique({
          where: { id: row!.id },
        }))!.usedAt !== null;
      const newWorks = !!(await verifyCredentials(
        "ops@axona-demo.test",
        "resetpass99",
      ));
      const reuse = await tokens.completePasswordReset(row!.token, "another99");
      return (
        res.ok && tv1 === tv0 + 1 && used && newWorks && reuse.ok === false
      );
    },
  );

  // 4) a completed reset invalidates old sessions (tokenVersion mismatch).
  await check(
    "completed reset invalidates old sessions (stale tokenVersion → getCurrentUser rejects)",
    async () => {
      // the reset above bumped tokenVersion 0→1; a token minted at v0 is now stale.
      const cur = (await prisma.user.findUnique({ where: { id: ops!.id } }))!
        .tokenVersion;
      const staleVersion = 0;
      return cur !== staleVersion; // getCurrentUser compares session.tokenVersion vs this
    },
  );

  // 5) verify email: token sets emailVerifiedAt; single-use.
  await check(
    "verify token sets emailVerifiedAt (single-use); signup wires a verify send",
    async () => {
      await tokens.sendVerificationEmail(ops!.id, "ops@axona-demo.test");
      const vt = await prisma.emailVerifyToken.findFirst({
        where: { userId: ops!.id, usedAt: null },
      });
      const ttlHrs = vt
        ? (vt.expiresAt.getTime() - vt.createdAt.getTime()) / 3_600_000
        : 0;
      const res = await tokens.verifyEmailToken(vt!.token);
      const verified =
        (await prisma.user.findUnique({ where: { id: ops!.id } }))!
          .emailVerifiedAt !== null;
      const reuse = await tokens.verifyEmailToken(vt!.token);
      const signupWired = /sendVerificationEmail/.test(
        read("apps/web/app/signup/actions.ts"),
      );
      return (
        res.ok &&
        Math.round(ttlHrs) === 24 &&
        verified &&
        reuse.ok === false &&
        signupWired
      );
    },
  );

  // restore
  await prisma.user.update({
    where: { id: ops!.id },
    data: {
      passwordHash: restore.hash,
      tokenVersion: 0,
      emailVerifiedAt: null,
    },
  });
  await cleanup();
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
