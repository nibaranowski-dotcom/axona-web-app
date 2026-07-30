/**
 * Verify ADMIN.1 — db:add-user (provision a real user into an org, SSO-ready).
 * Static checks always run; DB checks gate on DATABASE_URL. Self-cleaning.
 * Run: pnpm verify:admin-1
 *
 *   1. db:add-user is wired; the core reuses the SAME User write (orgId·email·name·
 *      role) — no fork; SSO-ready (no passwordHash set); idempotent by unique email.
 *   2. Creates a user for a fresh email in a seeded org with the right role.
 *   3. Re-running the same email UPDATES (idempotent — no duplicate); created-vs-updated.
 *   4. The created user has no usable credentials password (verifyCredentials → null)
 *      but IS email-linkable for SSO (linkGoogleUser matches).
 *   5. Org resolves by id AND by slug; a nonexistent org / bad role errors clearly.
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

const TEST_EMAIL = "admin1-verify@provision.test";

async function run(): Promise<void> {
  console.log("\nVerifying ADMIN.1 — db:add-user\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  // strip comments so greps assert real code, not the doc prose (which mentions
  // "passwordHash stays null" — a comment, not a write).
  const decomment = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const core = decomment(read("src/scripts/lib/add-user-core.ts"));
  const cli = read("src/scripts/add-user.ts");
  const pkg = read("package.json");

  // ── 1 (static): wired · reuses the User write · SSO-ready · idempotent ──
  await check("db:add-user is wired (package.json) → the CLI script", () => {
    return (
      /"db:add-user": "tsx src\/scripts\/add-user\.ts"/.test(pkg) &&
      /addUserToOrg\(/.test(cli) &&
      /--email/.test(cli) &&
      /--org/.test(cli) &&
      /--role/.test(cli) &&
      /--name/.test(cli)
    );
  });
  await check(
    "reuses the existing User write (orgId·email·name·role); NO fork; SSO-ready (no password set)",
    () => {
      return (
        /prisma\.user\.create\(/.test(core) &&
        /data: \{ orgId: org\.id, email, name, role/.test(core) && // same write shape
        /prisma\.user\.update\(/.test(core) && // idempotent update path
        // SSO-only: the core never sets a password / invents a hash.
        !/passwordHash|bcrypt/.test(core)
      );
    },
  );
  await check(
    "idempotent by unique email (find by email → update, else create)",
    () => {
      return (
        /findUnique\(\{\s*where: \{ email \}/.test(core) &&
        /action: "updated"/.test(core) &&
        /action: "created"/.test(core)
      );
    },
  );
  await check("org resolves by id OR slug", () => {
    return /findFirst\(\{\s*where: \{ OR: \[\{ id: orgRef \}, \{ slug: orgRef \}\]/.test(
      core,
    );
  });

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP data checks — DATABASE_URL not set (static only)");
    finish();
    return;
  }

  const { prisma } = await import("@axona/db");
  const { addUserToOrg } = await import("./lib/add-user-core");
  const { verifyCredentials } = await import("../../apps/web/lib/credentials");
  const { linkGoogleUser } = await import("../../apps/web/lib/google-sso");

  const org = await prisma.org.findFirst({
    where: { slug: { not: null } },
    select: { id: true, name: true, slug: true },
  });
  if (!org?.slug) {
    console.log("  FAIL no seeded org with a slug (run pnpm db:seed)");
    failed++;
    finish();
    return;
  }

  // clean any prior run (LoginSession.userId is scalar — no relation filter)
  const cleanup = async () => {
    const u = await prisma.user.findUnique({
      where: { email: TEST_EMAIL },
      select: { id: true },
    });
    if (u) await prisma.loginSession.deleteMany({ where: { userId: u.id } });
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  };
  await cleanup();

  try {
    // ── 2: create for a fresh email in a seeded org (resolve by SLUG) ──
    await check(
      "create: a fresh email in a seeded org (by slug) → created with the right role/org",
      async () => {
        const res = await addUserToOrg({
          email: TEST_EMAIL,
          org: org.slug!,
          role: "ENGINEER",
          name: "Verify Person",
        });
        if (!res.ok) return false;
        const u = await prisma.user.findUnique({
          where: { email: TEST_EMAIL },
          select: { role: true, orgId: true, name: true },
        });
        return (
          res.action === "created" &&
          u?.role === "ENGINEER" &&
          u?.orgId === org.id &&
          u?.name === "Verify Person"
        );
      },
    );

    // ── 3: idempotent — re-run same email (by ID) → updated, no dup ──
    await check(
      "idempotent: re-running the same email (org by id, new role) → UPDATED, no duplicate",
      async () => {
        const res = await addUserToOrg({
          email: TEST_EMAIL,
          org: org.id, // resolve by id this time
          role: "OPS",
          name: "Verify Person",
        });
        const count = await prisma.user.count({ where: { email: TEST_EMAIL } });
        const u = await prisma.user.findUnique({
          where: { email: TEST_EMAIL },
          select: { role: true },
        });
        return (
          res.ok &&
          res.action === "updated" &&
          count === 1 && // no duplicate
          u?.role === "OPS" // role updated in place
        );
      },
    );

    // ── 4: SSO-ready — no usable credentials password, but email-linkable ──
    await check(
      "SSO-ready: no usable credentials password (verifyCredentials → null) but email-linkable for SSO",
      async () => {
        // credentials login disabled (passwordHash null).
        const cred = await verifyCredentials(TEST_EMAIL, "anything-at-all");
        // AUTH.SSO links this user by verified email.
        const linked = await linkGoogleUser({
          email: TEST_EMAIL,
          emailVerified: true,
        });
        return cred === null && linked.ok && linked.user.email === TEST_EMAIL;
      },
    );

    // ── 5: clear errors — nonexistent org, bad role ──
    await check(
      "errors clearly on a nonexistent org and an invalid role",
      async () => {
        const noOrg = await addUserToOrg({
          email: "x@y.test",
          org: "org-does-not-exist",
          role: "ADMIN",
          name: "X",
        });
        const badRole = await addUserToOrg({
          email: "x@y.test",
          org: org.slug!,
          role: "SUPERADMIN",
          name: "X",
        });
        return (
          !noOrg.ok &&
          /no org matches/.test(noOrg.error) &&
          !badRole.ok &&
          /role must be one of/.test(badRole.error)
        );
      },
    );
  } finally {
    // self-clean: the SSO check created a LoginSession; remove it + the test user.
    await cleanup();
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
