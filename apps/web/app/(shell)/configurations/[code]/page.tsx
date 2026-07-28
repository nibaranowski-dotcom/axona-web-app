import { getCurrentUser } from "@/lib/session";
import { hasRole } from "@/lib/rbac";
import { getConfigurationDetail } from "@/lib/configurations";
import { ConfigurationDetailView } from "@/components/configurations/ConfigurationDetailView";
import { ScreenShell, ScreenMessage } from "@/components/shell/ScreenShell";

// /configurations/:code (PLM.11 · `Configuration.dc.html`) — the full-page view of one
// named ConfigurationVersion: resolved HW+SW manifest (frozen for a baseline), baseline
// state + dual-approver lock, matching-units → registry, version diff (as-built
// alignment), change history. Lock/unlock routes through decide() (RBAC + audited).
// DETAIL screen → breadcrumbs. Org-scoped via getConfigurationDetail → dbForOrg.
export const dynamic = "force-dynamic";

export default async function ConfigurationDetailPage({
  params,
}: {
  params: { code: string };
}) {
  const code = decodeURIComponent(params.code);
  const user = await getCurrentUser();
  if (!user) {
    return (
      <ScreenShell header={<Header code={code} />}>
        <ScreenMessage>
          <p className="text-sm text-ink-muted">
            Sign in to view this configuration.
          </p>
        </ScreenMessage>
      </ScreenShell>
    );
  }

  const data = await getConfigurationDetail(user.orgId, code);
  if (!data) {
    return (
      <ScreenShell header={<Header code={code} />}>
        <ScreenMessage>
          <p className="text-sm text-ink-muted">
            No configuration <span className="font-mono">{code}</span> in this
            workspace.
          </p>
        </ScreenMessage>
      </ScreenShell>
    );
  }

  return (
    <ConfigurationDetailView
      data={data}
      canLock={hasRole(user, ["ENGINEER", "ADMIN"])}
    />
  );
}

function Header({ code }: { code: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
        Engineering · configuration
      </div>
      <h1 className="mt-0.5 font-mono text-[19px] font-semibold tracking-[-0.02em] text-ink">
        {code}
      </h1>
    </div>
  );
}
