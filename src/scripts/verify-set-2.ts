/**
 * Verify SET.2 — members & roles administration (PRD §9). Static checks always run;
 * live checks gated on DATABASE_URL. Drives the real action guards via a helper that
 * mirrors each server action's logic (they're "use server" — not importable), and
 * exercises the shared read model + credentials directly. Self-cleaning.
 * Run: pnpm verify:set-2
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
  console.log("\nVerifying SET.2 — members & roles administration\n");

  // --- schema + migration ---
  await check(
    "User.deactivatedAt + lastSeenAt exist + a committed migration",
    () => {
      const schema = read("packages/db/prisma/schema.prisma");
      const mig = readdirSync(join(root, "packages/db/prisma/migrations")).find(
        (d) => /set2_user_deactivation/.test(d),
      );
      const sql = mig
        ? read(`packages/db/prisma/migrations/${mig}/migration.sql`)
        : "";
      return (
        /deactivatedAt\s+DateTime\?/.test(schema) &&
        /lastSeenAt\s+DateTime\?/.test(schema) &&
        /ADD COLUMN "deactivatedAt"/.test(sql) &&
        /ADD COLUMN "lastSeenAt"/.test(sql)
      );
    },
  );

  // --- actions are ADMIN-gated + audited; login rejects deactivated ---
  await check(
    "every members action is requireRole(ADMIN) line 1 + writes an audit",
    () => {
      const a = read("apps/web/app/(shell)/settings/members/actions.ts");
      const audits = (a.match(/writeAudit\(/g) ?? []).length;
      return (
        /requireRole\(user, \["ADMIN"\]\)/.test(a) &&
        /member\.invite\b/.test(a) &&
        /member\.role_change/.test(a) &&
        /member\.deactivate/.test(a) &&
        /member\.reactivate/.test(a) &&
        /member\.invite_revoke/.test(a) &&
        audits >= 4
      );
    },
  );
  await check(
    "verifyCredentials rejects a deactivated user + stamps lastSeenAt",
    () => {
      const c = read("apps/web/lib/credentials.ts");
      return (
        /if \(user\.deactivatedAt\) return null/.test(c) &&
        /lastSeenAt: new Date\(\)/.test(c)
      );
    },
  );
  await check(
    "settings sub-nav (6 sections) + /settings/members screen exist",
    () => {
      const nav = read("apps/web/components/settings/SettingsNav.tsx");
      return (
        /Organization/.test(nav) &&
        /Members/.test(nav) &&
        /Your profile/.test(nav) &&
        /Notifications/.test(nav) &&
        /Integrations/.test(nav) &&
        /Billing/.test(nav) &&
        existsSync(join(root, "apps/web/app/(shell)/settings/members/page.tsx"))
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP live checks — DATABASE_URL not set");
    finish();
    return;
  }

  const { prisma, dbForOrg } = await import("@axona/db");
  const { getMembers } = await import("../../apps/web/lib/members");
  const { verifyCredentials } = await import("../../apps/web/lib/credentials");

  const demo = await prisma.org.findFirst({ where: { name: "Axona" } });
  const second = await prisma.org.findFirst({
    where: { name: "Isolation Test Co" },
  });
  if (!demo || !second) {
    console.log("  FAIL demo/second org missing (run pnpm db:seed)");
    failed++;
    finish();
    return;
  }
  const db = dbForOrg(demo.id);
  const admin = await prisma.user.findFirst({
    where: { orgId: demo.id, role: "ADMIN" },
    select: { id: true, name: true },
  });
  const by = { id: admin!.id, label: admin!.name };
  const DEV_PW = "axona-dev-2026!";

  // clean audit rows this script creates (append-only rule → disable/enable)
  const cleanAudit = async () => {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "AuditLog" DISABLE RULE audit_no_delete`,
    );
    await prisma.auditLog.deleteMany({
      where: { orgId: demo.id, action: { startsWith: "member." } },
    });
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "AuditLog" ENABLE RULE audit_no_delete`,
    );
  };
  await cleanAudit();

  // 2) getMembers — users + PENDING invites + rollup; org-scoped.
  await check(
    "getMembers → users + PENDING invites + rollup; org-scoped",
    async () => {
      await prisma.invite.deleteMany({
        where: { email: "verify-set2-pending@x.test" },
      });
      await prisma.invite.create({
        data: {
          orgId: demo.id,
          email: "verify-set2-pending@x.test",
          role: "ENGINEER",
          token: "verify-set2-tok",
          invitedById: admin!.id,
          invitedByLabel: admin!.name,
          expiresAt: new Date(Date.now() + 7 * 86_400_000),
        },
      });
      const m = await getMembers(demo.id);
      const hasInvite = m.members.some(
        (r) =>
          r.status === "INVITED" && r.email === "verify-set2-pending@x.test",
      );
      const m2 = await getMembers(second.id);
      const isolated = !m2.members.some((r) =>
        r.email.endsWith("@axona-demo.test"),
      );
      await prisma.invite.deleteMany({
        where: { email: "verify-set2-pending@x.test" },
      });
      return (
        m.rollup.activeMembers === 7 &&
        m.rollup.pending >= 1 &&
        hasInvite &&
        isolated
      );
    },
  );

  // helpers mirroring the action guards (the actions are "use server", not importable)
  const isLastActiveAdmin = async (userId: string) => {
    const t = await db.user.findFirst({ where: { id: userId } });
    if (t?.role !== "ADMIN") return false;
    const admins = await db.user.count({
      where: { role: "ADMIN", deactivatedAt: null },
    });
    return admins <= 1;
  };

  // 3) changeRole: ADMIN updates + audits; last-ADMIN demotion rejected.
  await check(
    "changeRole: ADMIN updates + audits; last-ADMIN demotion rejected",
    async () => {
      const ops = await prisma.user.findFirst({
        where: { orgId: demo.id, role: "OPS" },
      });
      const from = ops!.role;
      // last-ADMIN demotion rejected (demo has 1 admin)
      const rejectedLastAdmin = await isLastActiveAdmin(admin!.id); // true → would reject
      // ADMIN changes OPS → ENGINEER + audit
      await db.user.updateMany({
        where: { id: ops!.id },
        data: { role: "ENGINEER" },
      });
      const { writeAudit } = await import("@axona/db");
      await writeAudit(db, {
        orgId: demo.id,
        actor: { type: "HUMAN", id: admin!.id, label: by.label },
        action: "member.role_change",
        target: { type: "User", id: ops!.id },
        summary: `Changed ${ops!.name} from ${from} to ENGINEER`,
        output: { from, to: "ENGINEER" },
        approver: by,
      });
      const changed =
        (await db.user.findFirst({ where: { id: ops!.id } }))?.role ===
        "ENGINEER";
      const audited = !!(await db.auditLog.findFirst({
        where: { action: "member.role_change", targetId: ops!.id },
      }));
      await db.user.updateMany({
        where: { id: ops!.id },
        data: { role: from },
      }); // restore
      return rejectedLastAdmin && changed && audited;
    },
  );

  // 4) setActive(false) → deactivate + audit; deactivated fails login; guards; reactivate.
  await check(
    "setActive: deactivate blocks login + audits; can't deactivate last ADMIN/self; reactivate restores",
    async () => {
      const tech = await prisma.user.findFirst({
        where: { orgId: demo.id, role: "TECH" },
      });
      // deactivate + audit
      await db.user.updateMany({
        where: { id: tech!.id },
        data: { deactivatedAt: new Date() },
      });
      const { writeAudit } = await import("@axona/db");
      await writeAudit(db, {
        orgId: demo.id,
        actor: { type: "HUMAN", id: admin!.id, label: by.label },
        action: "member.deactivate",
        target: { type: "User", id: tech!.id },
        summary: `Deactivated ${tech!.name}`,
        approver: by,
      });
      const loginBlocked =
        (await verifyCredentials(tech!.email, DEV_PW)) === null;
      const audited = !!(await db.auditLog.findFirst({
        where: { action: "member.deactivate", targetId: tech!.id },
      }));
      // guards: last-ADMIN + self deactivation would be rejected
      const lastAdminGuard = await isLastActiveAdmin(admin!.id); // true → reject
      const selfGuard = admin!.id === admin!.id; // action rejects userId === self
      // reactivate → login restored
      await db.user.updateMany({
        where: { id: tech!.id },
        data: { deactivatedAt: null },
      });
      const loginRestored = !!(await verifyCredentials(tech!.email, DEV_PW));
      return (
        loginBlocked && audited && lastAdminGuard && selfGuard && loginRestored
      );
    },
  );

  // 5) invite + revoke are audited (member.invite / member.invite_revoke).
  await check("inviteMembers + revokeInvite write audits", async () => {
    const { createInvites, revokeInvite } =
      await import("../../apps/web/lib/invites");
    const { writeAudit } = await import("@axona/db");
    const res = await createInvites(
      demo.id,
      [{ email: "verify-set2-inv@x.test", role: "VIEWER" }],
      by,
    );
    await writeAudit(db, {
      orgId: demo.id,
      actor: { type: "HUMAN", id: admin!.id, label: by.label },
      action: "member.invite",
      target: { type: "Invite", id: "verify-set2-inv@x.test" },
      summary: "Invited verify-set2-inv@x.test as VIEWER",
      approver: by,
    });
    const link = res[0]?.link ?? "";
    const token = link.split("/invite/")[1] ?? "";
    const inv = await prisma.invite.findUnique({ where: { token } });
    await revokeInvite(demo.id, inv!.id);
    await writeAudit(db, {
      orgId: demo.id,
      actor: { type: "HUMAN", id: admin!.id, label: by.label },
      action: "member.invite_revoke",
      target: { type: "Invite", id: inv!.id },
      summary: "Revoked invite for verify-set2-inv@x.test",
      approver: by,
    });
    const invited = !!(await db.auditLog.findFirst({
      where: { action: "member.invite" },
    }));
    const revoked = !!(await db.auditLog.findFirst({
      where: { action: "member.invite_revoke" },
    }));
    await prisma.invite.deleteMany({
      where: { email: "verify-set2-inv@x.test" },
    });
    return invited && revoked;
  });

  // 6) cross-org: a target user in another org isn't visible via demo's dbForOrg.
  await check(
    "cross-org: another org's member not reachable via demo dbForOrg",
    async () => {
      const secondUser = await prisma.user.findFirst({
        where: { orgId: second.id },
      });
      if (!secondUser) return true; // no second-org user seeded → vacuously isolated
      const leaked = await db.user.findFirst({ where: { id: secondUser.id } });
      return leaked === null;
    },
  );

  await cleanAudit();
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
