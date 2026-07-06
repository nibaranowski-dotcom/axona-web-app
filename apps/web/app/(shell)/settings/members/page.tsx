import { getCurrentUser } from "@/lib/session";
import { getMembers, ROLE_CAPABILITIES } from "@/lib/members";
import { getOrgSettings } from "@/lib/org-settings";
import { MembersView } from "@/components/settings/MembersView";

// /settings/members (SET.2) — the member & role admin screen, in the shell.
// ADMIN sees the controls; non-ADMIN gets the read-only roster (enforced server-
// side by the actions regardless). 1:1 to Settings - Members.dc.html.
export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const user = await getCurrentUser();
  if (!user) return null; // middleware already redirected
  const [data, settings] = await Promise.all([
    getMembers(user.orgId),
    getOrgSettings(user.orgId),
  ]);
  const isAdmin = user.role === "ADMIN";
  return (
    <MembersView
      data={data}
      capabilities={ROLE_CAPABILITIES}
      isAdmin={isAdmin}
      currentUserId={user.id}
      // SET.1: the org's default member role prefills new invites.
      defaultRole={settings?.defaultMemberRole ?? "OPS"}
    />
  );
}
