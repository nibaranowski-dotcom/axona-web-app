/**
 * Verify AUTH.4 — signup + org provisioning (PRD §9). Static checks always run;
 * live checks gated on DATABASE_URL. Uses the shared provisionWorkspace +
 * verifyCredentials (bcryptjs). Self-cleaning (removes the orgs/users it creates).
 * Run: pnpm verify:auth-4
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
  console.log("\nVerifying AUTH.4 — signup + org provisioning\n");

  // --- schema + migration ---
  await check(
    "Org.slug (unique) + Org.industry exist + a committed migration",
    () => {
      const schema = read("packages/db/prisma/schema.prisma");
      const mig = readdirSync(join(root, "packages/db/prisma/migrations")).find(
        (d) => /auth4_org_slug_industry/.test(d),
      );
      const sql = mig
        ? read(`packages/db/prisma/migrations/${mig}/migration.sql`)
        : "";
      return (
        /slug\s+String\?\s+@unique/.test(schema) &&
        /industry\s+String\?/.test(schema) &&
        /ADD COLUMN "slug"/.test(sql) &&
        /UNIQUE INDEX "Org_slug_key"/.test(sql)
      );
    },
  );

  // --- action wiring: public, provisions, auto sign-in, redirect ---
  await check(
    "signup action provisions + auto sign-in + redirect (server-only)",
    () => {
      const a = read("apps/web/app/signup/actions.ts");
      return (
        /"use server"/.test(a) &&
        /provisionWorkspace/.test(a) &&
        /signIn\("credentials"/.test(a) &&
        /redirectTo: "\/onboarding"/.test(a)
      );
    },
  );
  await check(
    "/signup + /onboarding routes exist; /signup public in middleware",
    () => {
      const cfg = read("apps/web/auth.config.ts");
      return (
        existsSync(join(root, "apps/web/app/signup/page.tsx")) &&
        existsSync(join(root, "apps/web/app/onboarding/page.tsx")) &&
        /\/signup/.test(cfg)
      );
    },
  );
  await check(
    "password bcrypt-hashed, Zod-validated; no plaintext store",
    () => {
      const p = read("apps/web/lib/provisioning.ts");
      return (
        /bcrypt\.hash/.test(p) &&
        /signupSchema/.test(p) &&
        /passwordHash/.test(p) &&
        !/password:\s*password\b/.test(p) // never stores the raw password
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP live checks — DATABASE_URL not set");
    finish();
    return;
  }

  const { prisma, dbForOrg } = await import("@axona/db");
  const { provisionWorkspace, slugify } =
    await import("../../apps/web/lib/provisioning");
  const { verifyCredentials } = await import("../../apps/web/lib/credentials");

  const TAG = "@auth4-verify.test";
  const cleanup = async () => {
    await prisma.user.deleteMany({ where: { email: { contains: TAG } } });
    await prisma.org.deleteMany({
      where: { slug: { startsWith: "verify-newco" } },
    });
  };
  await cleanup();

  const demo = await prisma.org.findFirst({ where: { name: "Axona Demo Co" } });

  // 1) createWorkspace → Org + ADMIN with a bcrypt hash that verifies.
  await check(
    "createWorkspace creates Org + ADMIN (bcrypt hash verifies)",
    async () => {
      const email = `founder1${TAG}`;
      const r = await provisionWorkspace({
        name: "Ada Lovelace",
        email,
        password: "strongpass1",
        orgName: "Verify NewCo",
        industry: "Humanoid",
      });
      if (!r.ok) return false;
      const u = await prisma.user.findUnique({
        where: { id: r.userId },
        select: { role: true, passwordHash: true, orgId: true },
      });
      return (
        u?.role === "ADMIN" &&
        !!u.passwordHash?.startsWith("$2") && // bcrypt, not plaintext
        u.orgId === r.orgId &&
        r.slug === slugify("Verify NewCo") &&
        !!(await verifyCredentials(email, "strongpass1"))
      );
    },
  );

  // 2) duplicate email → clean field error, no new Org/User, no throw.
  await check(
    "duplicate email → clean field error; no new Org/User",
    async () => {
      const beforeOrgs = await prisma.org.count();
      const beforeUsers = await prisma.user.count();
      const r = await provisionWorkspace({
        name: "Dupe",
        email: `founder1${TAG}`, // same as check 1
        password: "strongpass1",
        orgName: "Verify NewCo Dupe",
      });
      const afterOrgs = await prisma.org.count();
      const afterUsers = await prisma.user.count();
      return (
        r.ok === false &&
        r.field === "email" &&
        /already exists/.test(r.message) &&
        afterOrgs === beforeOrgs &&
        afterUsers === beforeUsers
      );
    },
  );

  // 3) slug collision → unique suffix.
  await check("slug collision → unique suffix (-2)", async () => {
    const r = await provisionWorkspace({
      name: "Bo",
      email: `founder2${TAG}`,
      password: "strongpass1",
      orgName: "Verify NewCo", // same org name as check 1
    });
    return r.ok === true && r.slug === `${slugify("Verify NewCo")}-2`;
  });

  // 4) isolation — the new ADMIN's dbForOrg sees an empty org, not the demo's data.
  await check(
    "isolation: new org empty; cannot read the demo org's data",
    async () => {
      const email = `founder3${TAG}`;
      const r = await provisionWorkspace({
        name: "Iso",
        email,
        password: "strongpass1",
        orgName: "Verify NewCo Iso",
      });
      if (!r.ok) return false;
      const db = dbForOrg(r.orgId);
      const agents = await db.agent.count();
      const projects = await db.project.count();
      const pos = await db.purchaseOrder.count();
      // A demo agent id must NOT be readable through the new org's client.
      const demoAgent = demo
        ? await dbForOrg(demo.id).agent.findFirst({ select: { id: true } })
        : null;
      const leaked = demoAgent
        ? await db.agent.findFirst({ where: { id: demoAgent.id } })
        : null;
      return agents === 0 && projects === 0 && pos === 0 && leaked === null;
    },
  );

  // 5) Zod rejects weak password / bad email / empty org name.
  await check(
    "Zod rejects weak password / bad email / empty org name",
    async () => {
      const weak = await provisionWorkspace({
        name: "X",
        email: `a${TAG}`,
        password: "short",
        orgName: "Z",
      });
      const badEmail = await provisionWorkspace({
        name: "X",
        email: "notanemail",
        password: "strongpass1",
        orgName: "Z",
      });
      const emptyOrg = await provisionWorkspace({
        name: "X",
        email: `b${TAG}`,
        password: "strongpass1",
        orgName: "",
      });
      return (
        weak.ok === false &&
        badEmail.ok === false &&
        badEmail.field === "email" &&
        emptyOrg.ok === false
      );
    },
  );

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
