/**
 * Verify AUTH.5 — invite + accept-invite (PRD §8). Static checks always run; live
 * checks gated on DATABASE_URL. Uses the shared invites lib + verifyCredentials.
 * Self-cleaning. Run: pnpm verify:auth-5
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
  console.log("\nVerifying AUTH.5 — invite + accept-invite\n");

  // --- schema + migration ---
  await check(
    "Invite model + InviteStatus + token unique + a committed migration",
    () => {
      const schema = read("packages/db/prisma/schema.prisma");
      const mig = readdirSync(join(root, "packages/db/prisma/migrations")).find(
        (d) => /auth5_invite/.test(d),
      );
      const sql = mig
        ? read(`packages/db/prisma/migrations/${mig}/migration.sql`)
        : "";
      return (
        /model Invite \{/.test(schema) &&
        /enum InviteStatus/.test(schema) &&
        /token\s+String\s+@unique/.test(schema) &&
        /expiresAt\s+DateTime/.test(schema) &&
        /CREATE TABLE "Invite"/.test(sql) &&
        /CREATE UNIQUE INDEX "Invite_token_key"/.test(sql)
      );
    },
  );

  // --- accept flow: never escalates the role; joins invite.orgId; single-use ---
  await check(
    "createInvites role-gated (ADMIN); accept creates user at invite.role (never escalated)",
    () => {
      const inviteActions = read("apps/web/app/onboarding/invite-actions.ts");
      const invites = read("apps/web/lib/invites.ts");
      return (
        /requireRole\(user, \["ADMIN"\]\)/.test(inviteActions) &&
        /createInvites\(user!\.orgId/.test(inviteActions) &&
        /role: invite\.role/.test(invites) && // EXACTLY the invited role
        /orgId: invite\.orgId/.test(invites) && // the invite's org only
        /status: "ACCEPTED"/.test(invites) && // single-use
        /bcrypt\.hash/.test(invites) &&
        /randomBytes\(32\)/.test(invites) // crypto-random ≥ 32B token
      );
    },
  );
  await check(
    "accept screen + action + link surface exist; /invite/* public",
    () => {
      const cfg = read("apps/web/auth.config.ts");
      return (
        existsSync(join(root, "apps/web/app/invite/[token]/page.tsx")) &&
        existsSync(join(root, "apps/web/app/invite/accept-action.ts")) &&
        /createInvitesAction/.test(
          read("apps/web/components/auth/OnboardingWizard.tsx"),
        ) &&
        /\/invite/.test(cfg)
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP live checks — DATABASE_URL not set");
    finish();
    return;
  }

  const { prisma, dbForOrg } = await import("@axona/db");
  const { createInvites, loadInvite, acceptInvite, revokeInvite } =
    await import("../../apps/web/lib/invites");
  const { verifyCredentials } = await import("../../apps/web/lib/credentials");

  const TAG = "@auth5-verify.test";
  const cleanup = async () => {
    await prisma.invite.deleteMany({ where: { email: { contains: TAG } } });
    await prisma.user.deleteMany({ where: { email: { contains: TAG } } });
  };
  await cleanup();

  const demo = await prisma.org.findFirst({ where: { name: "Axona Demo Co" } });
  const admin = await prisma.user.findFirst({
    where: { orgId: demo!.id, role: "ADMIN" },
    select: { id: true, name: true },
  });
  const inviter = { id: admin!.id, label: admin!.name };

  // 1) createInvites: PENDING + 7d expiry + unique tokens; per-row skip.
  await check(
    "createInvites → PENDING + ~7d expiry + unique token; existing/dup skipped (batch not aborted)",
    async () => {
      const res = await createInvites(
        demo!.id,
        [
          { email: `ops2${TAG}`, role: "OPS" },
          { email: "admin@axona-demo.test", role: "ADMIN" }, // existing user
          { email: "notanemail", role: "OPS" }, // invalid
        ],
        inviter,
      );
      const created = res.find((r) => r.status === "created");
      if (!created?.link) return false;
      const token = created.link.split("/invite/")[1] ?? "";
      const row = await prisma.invite.findUnique({ where: { token } });
      const ttlDays = row
        ? (row.expiresAt.getTime() - row.createdAt.getTime()) / 86_400_000
        : 0;
      // re-invite same email → skipped-already-invited
      const again = await createInvites(
        demo!.id,
        [{ email: `ops2${TAG}`, role: "OPS" }],
        inviter,
      );
      return (
        row?.status === "PENDING" &&
        token.length >= 32 &&
        ttlDays > 6.9 &&
        ttlDays < 7.1 &&
        res.some((r) => r.status === "skipped-existing-user") &&
        res.some((r) => r.status === "invalid") &&
        again[0]?.status === "skipped-already-invited"
      );
    },
  );

  // 2) accept a valid token → user at invited role (bcrypt) + ACCEPTED + not reusable.
  await check(
    "accept valid token → user at invited role (bcrypt verifies), ACCEPTED, not reusable",
    async () => {
      const res = await createInvites(
        demo!.id,
        [{ email: `join${TAG}`, role: "OPS" }],
        inviter,
      );
      const token = res[0]?.link!.split("/invite/")[1] ?? "";
      const load = await loadInvite(token);
      if (!load.ok || load.invite.role !== "OPS") return false;
      const acc = await acceptInvite({
        token,
        name: "Ops Joiner",
        password: "strongpass1",
      });
      if (!acc.ok) return false;
      const u = await prisma.user.findUnique({
        where: { id: acc.userId },
        select: { role: true, orgId: true, passwordHash: true },
      });
      const invite = await prisma.invite.findUnique({ where: { token } });
      const reuse = await acceptInvite({
        token,
        name: "X",
        password: "strongpass1",
      });
      return (
        u?.role === "OPS" && // EXACTLY the invited role — never ADMIN
        u.orgId === demo!.id &&
        !!u.passwordHash?.startsWith("$2") &&
        !!(await verifyCredentials(`join${TAG}`, "strongpass1")) &&
        invite?.status === "ACCEPTED" &&
        reuse.ok === false // single-use
      );
    },
  );

  // 3) expired / revoked / accepted → invalid, no user created.
  await check("expired / revoked tokens → invalid state, no user", async () => {
    await prisma.invite.create({
      data: {
        orgId: demo!.id,
        email: `exp${TAG}`,
        role: "OPS",
        token: `exp-${TAG}`,
        invitedById: admin!.id,
        invitedByLabel: admin!.name,
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    const expiredInvalid = !(await loadInvite(`exp-${TAG}`)).ok;

    const rv = await createInvites(
      demo!.id,
      [{ email: `rev${TAG}`, role: "VIEWER" }],
      inviter,
    );
    const rvtoken = rv[0]?.link!.split("/invite/")[1] ?? "";
    const rvId = (await prisma.invite.findUnique({
      where: { token: rvtoken },
    }))!.id;
    await revokeInvite(demo!.id, rvId);
    const revokedInvalid = !(await loadInvite(rvtoken)).ok;

    const before = await prisma.user.count();
    await acceptInvite({
      token: `exp-${TAG}`,
      name: "X",
      password: "strongpass1",
    });
    const after = await prisma.user.count();
    return expiredInvalid && revokedInvalid && before === after;
  });

  // 4) isolation: accepted user sees the inviting org only; role exactly as invited.
  await check(
    "isolation: accepted user in inviting org only; role exactly as invited",
    async () => {
      const res = await createInvites(
        demo!.id,
        [{ email: `iso${TAG}`, role: "VIEWER" }],
        inviter,
      );
      const token = res[0]?.link!.split("/invite/")[1] ?? "";
      const acc = await acceptInvite({
        token,
        name: "Iso User",
        password: "strongpass1",
      });
      if (!acc.ok) return false;
      const theirDb = dbForOrg(acc.orgId);
      const seesOrg = (await theirDb.agent.count()) > 0; // demo has agents
      // cross-org: a second org's agent id not readable through their db
      const other = await prisma.org.findFirst({
        where: { name: "Isolation Test Co" },
      });
      const otherSupplier = other
        ? await dbForOrg(other.id).supplier.findFirst({ select: { id: true } })
        : null;
      const leaked = otherSupplier
        ? await theirDb.supplier.findFirst({ where: { id: otherSupplier.id } })
        : null;
      return (
        acc.role === "VIEWER" &&
        acc.orgId === demo!.id &&
        seesOrg &&
        leaked === null
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
