/**
 * Verify AUTH.1 — Auth.js credentials + session + protected routes (PRD §11).
 * Pure-logic/static checks always run; live checks gated on DATABASE_URL. Uses the
 * shared verifyCredentials (bcryptjs) — no @/ alias, so it imports under tsx.
 * Run: pnpm verify:auth-1
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
  console.log(
    "\nVerifying AUTH.1 — Auth.js credentials + session + protected routes\n",
  );

  // --- schema + migration (one bounded add, via migrate) ---
  await check(
    "User.passwordHash exists (nullable) + a committed migration adds it",
    () => {
      const schema = read("packages/db/prisma/schema.prisma");
      const mig = readdirSync(join(root, "packages/db/prisma/migrations")).find(
        (d) => /auth1_user_password_hash/.test(d),
      );
      const migSql = mig
        ? read(`packages/db/prisma/migrations/${mig}/migration.sql`)
        : "";
      return (
        /passwordHash\s+String\?/.test(schema) &&
        /ALTER TABLE "User" ADD COLUMN "passwordHash"/.test(migSql)
      );
    },
  );

  // --- Auth.js config: credentials, jwt/session carry orgId+role, never the hash ---
  const authTs = read("apps/web/auth.ts");
  const authCfg = read("apps/web/auth.config.ts");
  const creds = read("apps/web/lib/credentials.ts");
  await check(
    "Credentials provider verifies via bcryptjs; session carries orgId+role",
    () => {
      return (
        /Credentials\(/.test(authTs) &&
        /verifyCredentials/.test(authTs) &&
        /bcrypt(js)?/.test(creds) &&
        /token\.orgId = user\.orgId/.test(authCfg) &&
        /token\.role = user\.role/.test(authCfg) &&
        /session\.user\.orgId/.test(authCfg) &&
        /session\.user\.role/.test(authCfg)
      );
    },
  );
  await check("passwordHash NEVER enters the return / token / session", () => {
    // Inspect CODE only (strip // and /* */ comments so the doc prose that says
    // "never the passwordHash" doesn't false-positive). credentials returns only
    // the session-safe fields; the session/jwt callbacks never touch the hash.
    const strip = (s: string) =>
      s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const credReturnsHash = /return\s*{[^}]*passwordHash/s.test(strip(creds));
    return (
      !credReturnsHash &&
      !/passwordHash/.test(strip(authTs)) &&
      !/passwordHash/.test(strip(authCfg))
    );
  });

  // --- session read (replaces the stub) ---
  await check(
    "getCurrentUser reads the Auth.js session + returns {id,orgId,role,name,email}",
    () => {
      const s = read("apps/web/lib/session.ts");
      return (
        /from "@\/auth"/.test(s) &&
        /await auth\(\)/.test(s) &&
        /orgId: u\.orgId/.test(s) &&
        /role: u\.role/.test(s) &&
        !/findFirst.*ADMIN/.test(s) // the stub is gone
      );
    },
  );

  // --- middleware: protect app routes; keep /login + /api/auth public ---
  await check(
    "middleware protects app routes; /login + /api/auth/* public; unauth → /login?next=",
    () => {
      const mw = read("apps/web/middleware.ts");
      return (
        /authConfig/.test(mw) &&
        /matcher/.test(mw) &&
        /\/login/.test(authCfg) &&
        /\/api\\\/auth|\/api\/auth/.test(authCfg) &&
        /searchParams\.set\("next"/.test(authCfg) &&
        /NextResponse\.redirect/.test(authCfg)
      );
    },
  );

  // --- .env.example documents AUTH_SECRET ---
  await check("AUTH_SECRET documented in .env.example", () => {
    return /AUTH_SECRET=/.test(read(".env.example"));
  });

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP live checks — DATABASE_URL not set");
    finish();
    return;
  }

  const { prisma } = await import("@axona/db");
  const { verifyCredentials } = await import("../../apps/web/lib/credentials");

  await check("all 7 seeded users have a passwordHash", async () => {
    const org = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    if (!org) return false;
    const users = await prisma.user.findMany({
      where: { orgId: org.id },
      select: { passwordHash: true },
    });
    return users.length === 7 && users.every((u) => !!u.passwordHash);
  });

  await check(
    "authorize accepts correct password (returns {id,orgId,role}, no hash)",
    async () => {
      const u = await verifyCredentials(
        "admin@axona-demo.test",
        "axona-dev-2026!",
      );
      return (
        !!u &&
        typeof u.orgId === "string" &&
        u.role === "ADMIN" &&
        !("passwordHash" in u)
      );
    },
  );

  await check(
    "authorize rejects wrong password + unknown email (null)",
    async () => {
      const wrong = await verifyCredentials("admin@axona-demo.test", "nope");
      const unknown = await verifyCredentials(
        "nobody@nowhere.test",
        "axona-dev-2026!",
      );
      const empty = await verifyCredentials("", "");
      return wrong === null && unknown === null && empty === null;
    },
  );

  await check(
    "a non-admin role authenticates (VIEWER) — RBAC now runs on the real role",
    async () => {
      const v = await verifyCredentials(
        "viewer@axona-demo.test",
        "axona-dev-2026!",
      );
      return v?.role === "VIEWER";
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
