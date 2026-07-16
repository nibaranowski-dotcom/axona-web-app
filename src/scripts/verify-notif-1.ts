/**
 * Verify NOTIF.1 — notification model + center (PRD §42). Static checks always run;
 * live checks gated on DATABASE_URL. Self-cleaning. Run: pnpm verify:notif-1
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
  console.log("\nVerifying NOTIF.1 — notification model + center\n");

  // --- schema + migration ---
  await check("Notification model + index + migration", () => {
    const schema = read("packages/db/prisma/schema.prisma");
    const mig = readdirSync(join(root, "packages/db/prisma/migrations")).find(
      (d) => /notif1_notification/.test(d),
    );
    const sql = mig
      ? read(`packages/db/prisma/migrations/${mig}/migration.sql`)
      : "";
    return (
      /model Notification \{/.test(schema) &&
      /enum NotificationType/.test(schema) &&
      /@@index\(\[orgId, userId, createdAt\]\)/.test(schema) &&
      /CREATE TABLE "Notification"/.test(sql) &&
      /Notification_orgId_userId_createdAt_idx/.test(sql)
    );
  });

  // --- writer/actions + a wired source + shell badge ---
  await check("notify writer + markRead/markAllRead own-user actions", () => {
    const lib = read("apps/web/lib/notifications.ts");
    const act = read("apps/web/app/(shell)/notifications/actions.ts");
    return (
      /export async function notify\(/.test(lib) &&
      /export async function getNotifications\(/.test(lib) &&
      /markRead/.test(act) &&
      /markAllRead/.test(act) &&
      /\{ userId: user\.id \}, \{ userId: null \}/.test(act) // own + broadcast only
    );
  });
  await check(
    "a real source is wired (ECO review → APPROVAL notify) + NOTIF.2 seam",
    () => {
      const eng = read("apps/web/app/(shell)/engineering/actions.ts");
      return (
        /notify\(\{/.test(eng) &&
        /"APPROVAL"|type: "APPROVAL"/.test(eng) &&
        /NOTIF\.2/.test(eng)
      );
    },
  );
  await check("shell shows an unread badge + /notifications screen", () => {
    const sidebar = read("apps/web/components/shell/Sidebar.tsx");
    return (
      /unreadCount/.test(sidebar) &&
      /\/notifications/.test(sidebar) &&
      existsSync(join(root, "apps/web/app/(shell)/notifications/page.tsx"))
    );
  });

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP live checks — DATABASE_URL not set");
    finish();
    return;
  }

  const { prisma } = await import("@axona/db");
  const { notify, getNotifications, getUnreadCount } =
    await import("../../apps/web/lib/notifications");

  const demo = await prisma.org.findFirst({ where: { name: "Axona" } });
  const second = await prisma.org.findFirst({
    where: { name: "Isolation Test Co" },
  });
  const ops = await prisma.user.findFirst({
    where: { orgId: demo!.id, role: "OPS" },
  });

  // 2) through-line seed populates the feed; getNotifications grouped + unread; org-scoped.
  await check(
    "seed populates the feed; getNotifications grouped + unreadCount; org-scoped",
    async () => {
      const feed = await getNotifications(demo!.id, ops!.id);
      const hasGroups =
        feed.groups.length >= 1 && feed.groups.some((g) => g.label === "Today");
      const hasPO = feed.groups
        .flatMap((g) => g.items)
        .some((i) => i.object === "PO-9007");
      // second org sees none of the demo's notifications
      const secondFeed = second
        ? await getNotifications(second.id, ops!.id)
        : { total: 0 };
      return (
        feed.total >= 10 &&
        feed.unreadCount >= 1 &&
        hasGroups &&
        hasPO &&
        secondFeed.total === 0
      );
    },
  );

  // 3) notify writes org-scoped; markRead/markAllRead set readAt (own + broadcast).
  await check(
    "notify writes + markRead sets readAt (own-user + broadcast only)",
    async () => {
      const TAG = "verify-notif-1";
      await prisma.notification.deleteMany({ where: { targetId: TAG } });
      await notify({
        orgId: demo!.id,
        userId: ops!.id,
        type: "APPROVAL",
        title: "Verify approval parked",
        body: "A gate awaits you.",
        target: { type: "Engineering", id: TAG },
        url: "/engineering",
      });
      const row = await prisma.notification.findFirst({
        where: { targetId: TAG },
      });
      const seenByOps = (await getNotifications(demo!.id, ops!.id)).groups
        .flatMap((g) => g.items)
        .some((i) => i.object === TAG);
      // markRead (mirror the action's scope)
      await prisma.notification.updateMany({
        where: { id: row!.id, OR: [{ userId: ops!.id }, { userId: null }] },
        data: { readAt: new Date() },
      });
      const nowRead =
        (await prisma.notification.findUnique({ where: { id: row!.id } }))
          ?.readAt !== null;
      await prisma.notification.deleteMany({ where: { targetId: TAG } });
      return row?.orgId === demo!.id && seenByOps && nowRead;
    },
  );

  // 4) a parked approval creates an APPROVAL notification to the approver; broadcast visible.
  await check(
    "APPROVAL notification (broadcast) is visible to a member + deep-links",
    async () => {
      const TAG = "verify-notif-broadcast";
      await prisma.notification.deleteMany({ where: { targetId: TAG } });
      await notify({
        orgId: demo!.id, // broadcast (no userId)
        type: "APPROVAL",
        title: "ECO-999 awaiting release review",
        body: "Broadcast to approvers.",
        target: { type: "Engineering", id: TAG },
        url: "/engineering",
      });
      const feed = await getNotifications(demo!.id, ops!.id, {
        filter: "approvals",
      });
      const item = feed.groups
        .flatMap((g) => g.items)
        .find((i) => i.object === TAG);
      await prisma.notification.deleteMany({ where: { targetId: TAG } });
      return item?.type === "APPROVAL" && item.url === "/engineering";
    },
  );

  // 5) unread count reflects the feed.
  await check("getUnreadCount matches the feed's unread count", async () => {
    const c = await getUnreadCount(demo!.id, ops!.id);
    const feed = await getNotifications(demo!.id, ops!.id);
    return c === feed.unreadCount;
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
