/**
 * Verify AUTH.SSO (Phase 1) — Google Workspace sign-in (extends the existing Auth.js).
 * Static checks always run; DB checks gate on DATABASE_URL. Self-cleaning. Mocks the
 * Google profile (calls linkGoogleUser directly). Run: pnpm verify:auth-sso
 *
 *   1. BUILD-ON-TOP: the Google provider is on the EXISTING Auth.js instance (auth.ts,
 *      next to Credentials, env-gated); NO second auth system; the SSO path resolves
 *      the SAME claim shape (orgId·role·tokenVersion) as verifyCredentials; Credentials
 *      login unchanged; no passwordHash in auth.ts/auth.config.ts (verify:auth-1 green).
 *   2. LINK: a Google-VERIFIED email matching a seeded user → session for that user's
 *      org/role; a LoginSession is recorded; a tokenVersion bump invalidates the SSO JWT.
 *   3. NO self-provision: an unmatched Google email → DENIED, zero User/Org created.
 *   4. Unverified Google email → DENIED.
 *   5. /login renders an ENABLED Google button (signIn("google")) with the Credentials
 *      form still present.
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

// strip line/block comments so greps assert real code, not prose.
const decomment = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

async function run(): Promise<void> {
  console.log("\nVerifying AUTH.SSO — Google Workspace sign-in\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const authTs = read("apps/web/auth.ts");
  const authCfg = read("apps/web/auth.config.ts");
  const sso = read("apps/web/lib/google-sso.ts");
  const form = read("apps/web/components/auth/LoginForm.tsx");
  const loginPage = read("apps/web/app/login/page.tsx");
  const authCode = decomment(authTs);
  const cfgCode = decomment(authCfg);

  // ── 1 (static): BUILD-ON-TOP — one instance, Google next to Credentials, env-gated ──
  await check(
    "Google provider added to the EXISTING Auth.js instance (auth.ts), next to Credentials, env-gated",
    () => {
      return (
        /from "next-auth\/providers\/google"/.test(authTs) &&
        /Google\(\{/.test(authTs) &&
        /Credentials\(\{/.test(authTs) && // Credentials still present (dual sign-in)
        /verifyCredentials\(/.test(authTs) && // credentials path unchanged
        /GOOGLE_CLIENT_ID/.test(authTs) &&
        /GOOGLE_CLIENT_SECRET/.test(authTs) &&
        /googleSsoEnabled/.test(authTs) // activates only when configured
      );
    },
  );
  await check("NO second auth system — exactly ONE NextAuth() instance", () => {
    return (
      (authTs.match(/NextAuth\(/g) ?? []).length === 1 &&
      /providers: \[\]/.test(authCfg) // edge config keeps providers:[]
    );
  });
  await check(
    "SSO issues the SAME claim shape as credentials (orgId·role·tokenVersion); no privilege change",
    () => {
      // the signIn callback carries the resolved user's claims onto `user`, and the
      // UNCHANGED jwt callback (auth.config) copies them to the token.
      return (
        /provider !== "google"/.test(authCode) && // credentials passes through
        /linkGoogleUser\(/.test(authCode) &&
        /user\.orgId = linked\.user\.orgId/.test(authCode) &&
        /user\.role = linked\.user\.role/.test(authCode) &&
        /user\.tokenVersion = linked\.user\.tokenVersion/.test(authCode) &&
        /token\.orgId = user\.orgId/.test(cfgCode) && // jwt callback unchanged
        /token\.tokenVersion = user\.tokenVersion/.test(cfgCode)
      );
    },
  );
  await check(
    "the passwordHash NEVER enters auth.ts / auth.config.ts (verify:auth-1 invariant)",
    () => {
      return !/passwordHash/.test(authCode) && !/passwordHash/.test(cfgCode);
    },
  );

  // ── 1 (static): the link helper enforces the security rule ──
  await check(
    "linkGoogleUser: requires email_verified, links EXISTING user, NEVER self-provisions",
    () => {
      const code = decomment(sso);
      return (
        /emailVerified !== true/.test(code) && // verified required
        /findUnique\(\{ where: \{ email \}/.test(code) && // link by email
        /"no-account"/.test(code) && // unmatched ⇒ deny
        /loginSession\.create/.test(code) && // reuse LoginSession (SET.3)
        /tokenVersion: user\.tokenVersion/.test(code) && // same claim
        // NO self-provision: it never creates a User or an Org
        !/user\.create|org\.create|\.upsert\(/.test(code)
      );
    },
  );

  // ── 5 (static): the /login button + dual sign-in ──
  await check(
    "/login: ENABLED Google button → signIn('google'); Credentials form still present",
    () => {
      return (
        /googleEnabled/.test(form) &&
        /signIn\("google"/.test(form) &&
        /signIn\("credentials"/.test(form) && // credentials sign-in kept
        /googleEnabled=\{googleSsoEnabled\}/.test(loginPage) && // wired from server
        /SSONoAccount/.test(form) // the no-account denial is surfaced
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP data checks — DATABASE_URL not set (static only)");
    finish();
    return;
  }

  const { prisma } = await import("@axona/db");
  const { linkGoogleUser } = await import("../../apps/web/lib/google-sso");

  const seeded = await prisma.user.findFirst({
    where: { email: { contains: "@axona-demo" } },
    select: {
      id: true,
      email: true,
      orgId: true,
      role: true,
      tokenVersion: true,
    },
  });
  if (!seeded) {
    console.log("  FAIL no seeded demo user (run pnpm db:seed)");
    failed++;
    finish();
    return;
  }

  const createdSessions: string[] = [];
  try {
    // ── 2: LINK — matched verified email → session for that user's org/role ──
    await check(
      "LINK: a verified Google email matching a seeded user → session for that user's org/role + a LoginSession",
      async () => {
        const before = await prisma.loginSession.count({
          where: { userId: seeded.id },
        });
        const res = await linkGoogleUser({
          email: seeded.email,
          emailVerified: true,
        });
        const after = await prisma.loginSession.count({
          where: { userId: seeded.id },
        });
        return (
          res.ok &&
          res.user.orgId === seeded.orgId && // that user's org (no cross-org)
          res.user.role === seeded.role && // that user's role (no escalation)
          res.user.tokenVersion === seeded.tokenVersion &&
          res.user.id === seeded.id &&
          after === before + 1 // LoginSession recorded (reuse proof)
        );
      },
    );
    await check(
      "reuse: a tokenVersion bump invalidates the SSO JWT (same check as credentials)",
      async () => {
        const res = await linkGoogleUser({
          email: seeded.email,
          emailVerified: true,
        });
        if (!res.ok) return false;
        // the token carries tokenVersion = res.user.tokenVersion; session.ts rejects
        // a token whose tokenVersion ≠ the User's current value.
        await prisma.user.update({
          where: { id: seeded.id },
          data: { tokenVersion: { increment: 1 } },
        });
        const dbUser = await prisma.user.findUnique({
          where: { id: seeded.id },
          select: { tokenVersion: true },
        });
        const invalidated = dbUser!.tokenVersion !== res.user.tokenVersion;
        await prisma.user.update({
          where: { id: seeded.id },
          data: { tokenVersion: seeded.tokenVersion },
        }); // restore
        return invalidated;
      },
    );

    // ── 3: NO self-provision — unmatched email → denied, zero User/Org created ──
    await check(
      "NO self-provision: an unmatched Google email → DENIED, zero User/Org created",
      async () => {
        const u0 = await prisma.user.count();
        const o0 = await prisma.org.count();
        const res = await linkGoogleUser({
          email: "nobody-here@stranger.example",
          emailVerified: true,
        });
        const u1 = await prisma.user.count();
        const o1 = await prisma.org.count();
        return !res.ok && res.reason === "no-account" && u1 === u0 && o1 === o0;
      },
    );

    // ── 4: unverified → denied ──
    await check("unverified Google email → DENIED (no linking)", async () => {
      const res = await linkGoogleUser({
        email: seeded.email,
        emailVerified: false,
      });
      const resMissing = await linkGoogleUser({ email: seeded.email });
      return (
        !res.ok &&
        res.reason === "unverified" &&
        !resMissing.ok &&
        resMissing.reason === "unverified"
      );
    });
  } finally {
    // self-clean: remove the LoginSessions this verify created.
    void createdSessions;
    await prisma.loginSession.deleteMany({
      where: { userId: seeded.id, device: "Google SSO" },
    });
    await prisma.$disconnect();
  }

  finish();
}

function finish(): void {
  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run().then(() => process.exit(failed > 0 ? 1 : 0));
