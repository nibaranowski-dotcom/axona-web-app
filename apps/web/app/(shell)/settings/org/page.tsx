import { getCurrentUser } from "@/lib/session";
import { getOrgSettings } from "@/lib/org-settings";
import { OrgSettingsView } from "@/components/settings/OrgSettingsView";

// /settings/org (SET.1) — organization settings, in the shell + Settings sub-nav.
// ADMIN edits; non-ADMIN read-only (server-enforced by the actions). 1:1 to
// Settings - Organization.dc.html.
export const dynamic = "force-dynamic";

export default async function OrgSettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const settings = await getOrgSettings(user.orgId);
  if (!settings) return null;
  return (
    <OrgSettingsView settings={settings} isAdmin={user.role === "ADMIN"} />
  );
}
