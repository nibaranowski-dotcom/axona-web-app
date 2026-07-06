import { getCurrentUser } from "@/lib/session";
import { getNotifications } from "@/lib/notifications";
import { NotificationsView } from "@/components/notifications/NotificationsView";

// /notifications (NOTIF.1) — the in-app notification center, a CORE route in the
// shell. Grouped activity feed of what needs the user. 1:1 to Notifications.dc.html.
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const feed = await getNotifications(user.orgId, user.id);
  return <NotificationsView feed={feed} />;
}
