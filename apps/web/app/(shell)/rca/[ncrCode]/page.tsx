import { getCurrentUser } from "@/lib/session";
import { hasRole } from "@/lib/rbac";
import { getRcaWorkspace } from "@/lib/rca";
import { getConnectedObjects } from "@/lib/connected-objects";
import { recordHistoryFor } from "@/lib/audit-trail";
import { attachmentsFor } from "@/lib/attachments";
import { CAN_ATTACH } from "@/lib/attach-roles";
import { RcaView } from "@/components/rca/RcaView";
import { ScreenShell, ScreenMessage } from "@/components/shell/ScreenShell";

// /rca/:ncrCode (PLM.8 · `RCA.dc.html`) — the root-cause workspace. Answers Q4:
// the failure + assembled evidence + an agent-proposed cause (calibrated
// confidence); the human classifies (RBAC-gated + audited via PLM.V2's action).
// DETAIL screen → breadcrumbs. Org-scoped via getRcaWorkspace → dbForOrg.
export const dynamic = "force-dynamic";

export default async function RcaPage({
  params,
}: {
  params: { ncrCode: string };
}) {
  const code = decodeURIComponent(params.ncrCode);
  const user = await getCurrentUser();
  if (!user) {
    return (
      <ScreenShell header={<Header code={code} />}>
        <ScreenMessage>
          <p className="text-sm text-ink-muted">Sign in to investigate.</p>
        </ScreenMessage>
      </ScreenShell>
    );
  }

  const rca = await getRcaWorkspace(user.orgId, code);
  if (!rca) {
    return (
      <ScreenShell header={<Header code={code} />}>
        <ScreenMessage>
          <p className="text-sm text-ink-muted">
            No NCR <span className="font-mono">{code}</span> in this workspace.
          </p>
        </ScreenMessage>
      </ScreenShell>
    );
  }

  const connected = await getConnectedObjects(user.orgId, "NCR", code);
  const history = await recordHistoryFor(user.orgId, "NCR", code);
  const attachments = await attachmentsFor(user.orgId, "NCR", code);
  return (
    <RcaView
      rca={rca}
      canClassify={hasRole(user, ["ENGINEER", "OPS", "ADMIN"])}
      connected={connected}
      history={history.entries}
      attachments={attachments}
      canManage={hasRole(user, CAN_ATTACH)}
    />
  );
}

function Header({ code }: { code: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
        Quality · RCA
      </div>
      <h1 className="mt-0.5 font-mono text-[19px] font-semibold tracking-[-0.02em] text-ink">
        {code}
      </h1>
    </div>
  );
}
