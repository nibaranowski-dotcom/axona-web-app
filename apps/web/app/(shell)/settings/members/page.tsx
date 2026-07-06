import { getCurrentUser } from "@/lib/session";
import { getMembers, ROLE_CAPABILITIES } from "@/lib/members";
import { MembersView } from "@/components/settings/MembersView";

// /settings/members (SET.2) — the member & role admin screen, in the shell.
// ADMIN sees the controls; non-ADMIN gets the read-only roster (enforced server-
// side by the actions regardless). 1:1 to Settings - Members.dc.html.
export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const user = await getCurrentUser();
  if (!user) return null; // middleware already redirected
  const data = await getMembers(user.orgId);
  const isAdmin = user.role === "ADMIN";
  return (
    <MembersView
      data={data}
      capabilities={ROLE_CAPABILITIES}
      isAdmin={isAdmin}
      currentUserId={user.id}
    />
  );
}
