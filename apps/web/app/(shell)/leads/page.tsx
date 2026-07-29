import { getCurrentUser } from "@/lib/session";
import { listLeads } from "@/lib/leads";
import { LeadsView } from "@/components/leads/LeadsView";
import { ScreenShell, ScreenMessage } from "@/components/shell/ScreenShell";

// /leads (LEAD.1) — the internal Leads triage view. AXONA-INTERNAL: reads the Lead
// table directly (never dbForOrg — leads are not tenant data). RBAC-gated to ADMIN;
// a non-admin is blocked (no lead data rendered). Newest-first with a status control.
export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const user = await getCurrentUser();
  if (!user) return null; // middleware already redirected

  // RBAC — leads are internal sales data; only an admin/owner sees them.
  if (user.role !== "ADMIN") {
    return (
      <ScreenShell header={<Header />}>
        <ScreenMessage>
          <p className="text-sm text-ink-muted">
            Leads are restricted to workspace admins.
          </p>
        </ScreenMessage>
      </ScreenShell>
    );
  }

  const data = await listLeads();
  return <LeadsView data={data} />;
}

function Header() {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
        Go-to-market · leads
      </div>
      <h1 className="mt-0.5 font-sans text-[19px] font-semibold tracking-[-0.02em] text-ink">
        Leads
      </h1>
    </div>
  );
}
