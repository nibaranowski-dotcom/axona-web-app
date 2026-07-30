import { getCurrentUser } from "@/lib/session";
import { hasRole } from "@/lib/rbac";
import { getChangeOrder } from "@/lib/change-order";
import { getConnectedObjects } from "@/lib/connected-objects";
import { recordHistoryFor } from "@/lib/audit-trail";
import { ChangeOrderView } from "@/components/changes/ChangeOrderView";
import { ScreenShell, ScreenMessage } from "@/components/shell/ScreenShell";

// /changes/:code (PLM.9 · `Change Order.dc.html`) — an ECO change order. Answers
// Q5: rationale · effectivity · COMPUTED affected units (respecting effectivity) ·
// per-unit rollout. Approve/reject routes through decide("eco.release") (RBAC.5).
// DETAIL screen → breadcrumbs. Org-scoped via getChangeOrder → dbForOrg.
export const dynamic = "force-dynamic";

export default async function ChangeOrderPage({
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
          <p className="text-sm text-ink-muted">Sign in to view this change.</p>
        </ScreenMessage>
      </ScreenShell>
    );
  }

  const data = await getChangeOrder(user.orgId, code);
  if (!data) {
    return (
      <ScreenShell header={<Header code={code} />}>
        <ScreenMessage>
          <p className="text-sm text-ink-muted">
            No change order <span className="font-mono">{code}</span> in this
            workspace.
          </p>
        </ScreenMessage>
      </ScreenShell>
    );
  }

  const connected = await getConnectedObjects(user.orgId, "ECO", code);
  const history = await recordHistoryFor(user.orgId, "ECO", code);
  return (
    <ChangeOrderView
      data={data}
      canDecide={hasRole(user, ["ENGINEER", "ADMIN"])}
      connected={connected}
      history={history.entries}
    />
  );
}

function Header({ code }: { code: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
        Engineering · change order
      </div>
      <h1 className="mt-0.5 font-mono text-[19px] font-semibold tracking-[-0.02em] text-ink">
        {code}
      </h1>
    </div>
  );
}
