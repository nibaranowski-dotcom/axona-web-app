import { getCurrentUser } from "@/lib/session";
import { getNotificationPrefs } from "@/lib/notification-prefs";
import { NotificationPrefsView } from "@/components/settings/NotificationPrefsView";

// /settings/notifications (SET.4) — the user's notification preferences (event ×
// channel matrix + mute + quiet hours). Own-user. 1:1 to Settings - Notifications.
export const dynamic = "force-dynamic";

export default async function NotificationSettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const initial = await getNotificationPrefs(user.id);
  return <NotificationPrefsView initial={initial} />;
}
