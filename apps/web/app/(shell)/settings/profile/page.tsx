import { getCurrentUser } from "@/lib/session";
import { getUserSettings } from "@/lib/user-settings";
import { ProfileSettingsView } from "@/components/settings/ProfileSettingsView";

// /settings/profile (SET.3) — the signed-in user's own profile & security, in the
// shell + Settings sub-nav. 1:1 to Settings - Profile.dc.html.
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const settings = await getUserSettings(user.id);
  if (!settings) return null;
  return <ProfileSettingsView settings={settings} />;
}
