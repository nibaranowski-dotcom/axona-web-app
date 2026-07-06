import { prisma, type NotificationType } from "@axona/db";

// NOTIF.1 — notification writer + read model (server-only). `notify()` is the ONLY
// writer. The center reads a user's own notifications OR org/role broadcasts
// (userId null), grouped Today/Earlier, with an unread count. Org-scoped.

export interface NotifyInput {
  orgId: string;
  userId?: string | null; // null/undefined = org/role broadcast
  type: NotificationType;
  title: string;
  body: string;
  target: { type: string; id: string };
  url: string;
}

export async function notify(input: NotifyInput): Promise<void> {
  await prisma.notification.create({
    data: {
      orgId: input.orgId,
      userId: input.userId ?? null,
      type: input.type,
      title: input.title,
      body: input.body,
      targetType: input.target.type,
      targetId: input.target.id,
      url: input.url,
    },
  });
}

export interface NotificationRow {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  source: string; // module label derived from targetType
  object: string; // targetId
  url: string;
  unread: boolean;
  createdAt: Date;
}

export interface NotificationFeed {
  groups: { label: string; items: NotificationRow[] }[];
  unreadCount: number;
  approvalCount: number;
  total: number;
}

const startOfToday = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

/**
 * The user's notifications: rows targeted at THEM plus org/role broadcasts (userId
 * null) for their org. Newest first, grouped Today/Earlier, with unread + approval
 * counts. Org-scoped — never another org's rows.
 */
export async function getNotifications(
  orgId: string,
  userId: string,
  opts: { filter?: "all" | "unread" | "approvals" } = {},
): Promise<NotificationFeed> {
  const rows = await prisma.notification.findMany({
    where: {
      orgId,
      OR: [{ userId }, { userId: null }], // own + broadcasts
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const unreadCount = rows.filter((r) => !r.readAt).length;
  const approvalCount = rows.filter(
    (r) => r.type === "APPROVAL" && !r.readAt,
  ).length;

  const filtered = rows.filter((r) => {
    if (opts.filter === "unread") return !r.readAt;
    if (opts.filter === "approvals") return r.type === "APPROVAL";
    return true;
  });

  const todayStart = startOfToday().getTime();
  const map = (r: (typeof rows)[number]): NotificationRow => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    source: r.targetType,
    object: r.targetId,
    url: r.url,
    unread: !r.readAt,
    createdAt: r.createdAt,
  });

  const today = filtered
    .filter((r) => r.createdAt.getTime() >= todayStart)
    .map(map);
  const earlier = filtered
    .filter((r) => r.createdAt.getTime() < todayStart)
    .map(map);

  const groups: { label: string; items: NotificationRow[] }[] = [];
  if (today.length) groups.push({ label: "Today", items: today });
  if (earlier.length) groups.push({ label: "Earlier", items: earlier });

  return { groups, unreadCount, approvalCount, total: rows.length };
}

// A lightweight unread count for the shell badge.
export async function getUnreadCount(
  orgId: string,
  userId: string,
): Promise<number> {
  return prisma.notification.count({
    where: { orgId, readAt: null, OR: [{ userId }, { userId: null }] },
  });
}
