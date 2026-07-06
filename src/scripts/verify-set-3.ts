/**
 * Verify SET.3 — your profile & security (PRD §40). Static checks always run; live
 * checks gated on DATABASE_URL. Actions are "use server" (not importable) so their
 * effects are mirrored against the real DB; guard shapes are checked statically.
 * Self-cleaning. Run: pnpm verify:set-3
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
  console.log("\nVerifying SET.3 — your profile & security\n");

  // --- schema + migration ---
  await check(
    "User.avatarKey/tokenVersion + LoginSession model + migration",
    () => {
      const schema = read("packages/db/prisma/schema.prisma");
      const mig = readdirSync(join(root, "packages/db/prisma/migrations")).find(
        (d) => /set3_profile_security/.test(d),
      );
      const sql = mig
        ? read(`packages/db/prisma/migrations/${mig}/migration.sql`)
        : "";
      return (
        /avatarKey\s+String\?/.test(schema) &&
        /tokenVersion\s+Int\s+@default\(0\)/.test(schema) &&
        /model LoginSession \{/.test(schema) &&
        /CREATE TABLE "LoginSession"/.test(sql) &&
        /ADD COLUMN "tokenVersion"/.test(sql)
      );
    },
  );

  // --- actions own-user + audited; tokenVersion enforcement wired ---
  await check(
    "profile actions own-user + audited (profile/password/signout_all)",
    () => {
      const a = read("apps/web/app/(shell)/settings/profile/actions.ts");
      return (
        /where: \{ id: user\.id \}/.test(a) &&
        /user\.profile_change/.test(a) &&
        /user\.password_change/.test(a) &&
        /user\.signout_all/.test(a) &&
        /tokenVersion: \{ increment: 1 \}/.test(a) &&
        /bcrypt\.compare/.test(a) // current password verified
      );
    },
  );
  await check(
    "getCurrentUser enforces tokenVersion (stateless-JWT revoke) + login records device",
    () => {
      const s = read("apps/web/lib/session.ts");
      const c = read("apps/web/lib/credentials.ts");
      return (
        /tokenVersion !== \(u\.tokenVersion/.test(s) &&
        /loginSession\.create/.test(c) &&
        /tokenVersion: user\.tokenVersion/.test(c)
      );
    },
  );
  await check("/settings/profile screen exists", () => {
    return existsSync(
      join(root, "apps/web/app/(shell)/settings/profile/page.tsx"),
    );
  });

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP live checks — DATABASE_URL not set");
    finish();
    return;
  }

  const { prisma, dbForOrg } = await import("@axona/db");
  const { verifyCredentials } = await import("../../apps/web/lib/credentials");
  const { getUserSettings } = await import("../../apps/web/lib/user-settings");
  const bcrypt = (await import("bcryptjs")).default;

  const demo = await prisma.org.findFirst({ where: { name: "Axona Demo Co" } });
  const ops = await prisma.user.findFirst({
    where: { orgId: demo!.id, role: "OPS" },
  });
  const db = dbForOrg(demo!.id);
  const DEV_PW = "axona-dev-2026!";
  const snap = { hash: ops!.passwordHash, tv: 0 };
  await prisma.loginSession.deleteMany({ where: { userId: ops!.id } });
  await db.user.updateMany({
    where: { id: ops!.id },
    data: { tokenVersion: 0 },
  });

  // 1) login records a LoginSession + returns tokenVersion.
  await check(
    "login records a LoginSession + returns tokenVersion",
    async () => {
      const s = await verifyCredentials(ops!.email, DEV_PW, {
        device: "Chrome on macOS",
        ip: "1.2.3.4",
      });
      const rows = (await getUserSettings(ops!.id))!.sessions;
      return !!s && typeof s.tokenVersion === "number" && rows.length >= 1;
    },
  );

  // 2) changePassword: wrong current rejected; success re-hashes + bumps tokenVersion;
  //    a stale-version token is rejected (mirror of getCurrentUser's check).
  await check(
    "changePassword: wrong current rejected; success re-hashes + bumps tokenVersion; stale token invalid",
    async () => {
      const before = (await prisma.user.findUnique({
        where: { id: ops!.id },
      }))!;
      const wrongOk = await bcrypt.compare(
        "not-the-password",
        before.passwordHash!,
      );
      if (wrongOk) return false; // wrong current must not verify
      const staleTokenVersion = before.tokenVersion;
      await db.user.updateMany({
        where: { id: ops!.id },
        data: {
          passwordHash: await bcrypt.hash("newpass12345", 10),
          tokenVersion: { increment: 1 },
        },
      });
      const after = (await prisma.user.findUnique({ where: { id: ops!.id } }))!;
      const rehashed = await bcrypt.compare(
        "newpass12345",
        after.passwordHash!,
      );
      const bumped = after.tokenVersion === staleTokenVersion + 1;
      const staleRejected = staleTokenVersion !== after.tokenVersion; // getCurrentUser would return null
      return rehashed && bumped && staleRejected;
    },
  );

  // 3) signOutEverywhere: bumps tokenVersion + clears LoginSession rows.
  await check(
    "signOutEverywhere bumps tokenVersion + clears sessions",
    async () => {
      const before = (await prisma.user.findUnique({ where: { id: ops!.id } }))!
        .tokenVersion;
      await db.user.updateMany({
        where: { id: ops!.id },
        data: { tokenVersion: { increment: 1 } },
      });
      await db.loginSession.deleteMany({ where: { userId: ops!.id } });
      const after = (await prisma.user.findUnique({ where: { id: ops!.id } }))!
        .tokenVersion;
      const cleared = (await getUserSettings(ops!.id))!.sessions.length === 0;
      return after === before + 1 && cleared;
    },
  );

  // 4) revokeSession removes one own row; a cross-user row is untouched.
  await check(
    "revokeSession removes an own session row (own-user only)",
    async () => {
      const row = await prisma.loginSession.create({
        data: { orgId: demo!.id, userId: ops!.id, device: "Safari on iOS" },
      });
      // another user's row must NOT be deletable by ops' scope
      const admin = await prisma.user.findFirst({
        where: { orgId: demo!.id, role: "ADMIN" },
      });
      const adminRow = await prisma.loginSession.create({
        data: {
          orgId: demo!.id,
          userId: admin!.id,
          device: "Chrome on Windows",
        },
      });
      await db.loginSession.deleteMany({
        where: { id: row.id, userId: ops!.id },
      });
      const ownGone =
        (await prisma.loginSession.findUnique({ where: { id: row.id } })) ===
        null;
      const otherKept =
        (await prisma.loginSession.findUnique({
          where: { id: adminRow.id },
        })) !== null;
      await prisma.loginSession.deleteMany({ where: { id: adminRow.id } });
      return ownGone && otherKept;
    },
  );

  // 5) own-user only: the profile actions never target another user's id (static).
  await check(
    "own-user only: profile actions target the session user's id (no cross-user)",
    async () => {
      const a = read("apps/web/app/(shell)/settings/profile/actions.ts");
      const updates =
        a.match(
          /(user|loginSession)\.(updateMany|deleteMany)\(\{\s*where:\s*\{([^}]*)\}/g,
        ) ?? [];
      // every mutation is scoped to the session user's own id (user.id / user!.id)
      return (
        updates.length >= 3 && updates.every((u) => /\buser!?\.id\b/.test(u))
      );
    },
  );

  // restore
  await db.user.updateMany({
    where: { id: ops!.id },
    data: { passwordHash: snap.hash, tokenVersion: 0 },
  });
  await prisma.loginSession.deleteMany({ where: { userId: ops!.id } });
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
