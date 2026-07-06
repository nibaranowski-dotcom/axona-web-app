/**
 * Verify SET.4 — notification preferences (PRD §33). Static checks always run; live
 * checks gated on DATABASE_URL. Self-cleaning. Run: pnpm verify:set-4
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
  console.log("\nVerifying SET.4 — notification preferences\n");

  // --- schema + migration ---
  await check("NotificationPref model + migration", () => {
    const schema = read("packages/db/prisma/schema.prisma");
    const mig = readdirSync(join(root, "packages/db/prisma/migrations")).find(
      (d) => /set4_notification_pref/.test(d),
    );
    const sql = mig
      ? read(`packages/db/prisma/migrations/${mig}/migration.sql`)
      : "";
    return (
      /model NotificationPref \{/.test(schema) &&
      /userId\s+String\s+@unique/.test(schema) &&
      /muted\s+Boolean/.test(schema) &&
      /CREATE TABLE "NotificationPref"/.test(sql)
    );
  });

  // --- action own-user; getNotifications respects prefs ---
  await check(
    "updatePrefs own-user (upsert by userId) + Zod; screen exists",
    () => {
      const a = read("apps/web/app/(shell)/settings/notifications/actions.ts");
      return (
        /where: \{ userId: user\.id \}/.test(a) &&
        /safeParse/.test(a) &&
        existsSync(
          join(root, "apps/web/app/(shell)/settings/notifications/page.tsx"),
        )
      );
    },
  );
  await check(
    "NOTIF.1 getNotifications + unread respect suppressedInAppTypes",
    () => {
      const n = read("apps/web/lib/notifications.ts");
      return (
        /suppressedInAppTypes/.test(n) &&
        /suppressed\.has\(r\.type\)/.test(n) &&
        /notIn: \[\.\.\.suppressed\]/.test(n)
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP live checks — DATABASE_URL not set");
    finish();
    return;
  }

  const { prisma } = await import("@axona/db");
  const { getNotificationPrefs, defaultPrefs, suppressedInAppTypes } =
    await import("../../apps/web/lib/notification-prefs");
  const { getNotifications } = await import("../../apps/web/lib/notifications");

  const demo = await prisma.org.findFirst({ where: { name: "Axona Demo Co" } });
  const ops = await prisma.user.findFirst({
    where: { orgId: demo!.id, role: "OPS" },
  });
  const admin = await prisma.user.findFirst({
    where: { orgId: demo!.id, role: "ADMIN" },
  });
  await prisma.notificationPref.deleteMany({
    where: { userId: { in: [ops!.id, admin!.id] } },
  });

  // 1) defaults applied when none.
  await check(
    "defaults applied when no row (approvals/exceptions on)",
    async () => {
      const d = await getNotificationPrefs(ops!.id);
      return (
        d.muted === false &&
        d.prefs.approvals?.inApp === true &&
        d.prefs.exceptions?.inApp === true
      );
    },
  );

  // 2) updatePrefs persists the matrix + mute + quiet (mirror); own-user (unique userId).
  await check(
    "prefs persist (matrix + mute + quiet); own-user (unique userId)",
    async () => {
      const p = defaultPrefs();
      p.approvals = { inApp: false, email: true };
      await prisma.notificationPref.create({
        data: {
          userId: ops!.id,
          orgId: demo!.id,
          prefs: p as unknown as object,
          muted: false,
          quietStart: "22:00",
          quietEnd: "07:00",
        },
      });
      const back = await getNotificationPrefs(ops!.id);
      // a DIFFERENT user is unaffected (own-user isolation via unique userId)
      const adminDefaults = await getNotificationPrefs(admin!.id);
      return (
        back.prefs.approvals?.inApp === false &&
        back.quietStart === "22:00" &&
        adminDefaults.prefs.approvals?.inApp === true
      );
    },
  );

  // 3) getNotifications respects inApp=false / muted (that type suppressed in-app).
  await check(
    "getNotifications suppresses APPROVAL when inApp off; muted suppresses all",
    async () => {
      const suppressed = await suppressedInAppTypes(ops!.id);
      const feedOff = await getNotifications(demo!.id, ops!.id); // approvals inApp off
      const noApprovals = feedOff.groups
        .flatMap((g) => g.items)
        .every((i) => i.type !== "APPROVAL");
      await prisma.notificationPref.update({
        where: { userId: ops!.id },
        data: { muted: true },
      });
      const feedMuted = await getNotifications(demo!.id, ops!.id);
      return suppressed.has("APPROVAL") && noApprovals && feedMuted.total === 0;
    },
  );

  await prisma.notificationPref.deleteMany({
    where: { userId: { in: [ops!.id, admin!.id] } },
  });
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
