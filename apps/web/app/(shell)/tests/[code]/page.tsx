import { getCurrentUser } from "@/lib/session";
import { getTestRun } from "@/lib/tests";
import { hasRole } from "@/lib/rbac";
import { getConnectedObjects } from "@/lib/connected-objects";
import { recordHistoryFor } from "@/lib/audit-trail";
import { attachmentsFor } from "@/lib/attachments";
import { CAN_ATTACH } from "@/lib/attach-roles";
import { TestRunView } from "@/components/tests/TestRunView";
import { ScreenShell, ScreenMessage } from "@/components/shell/ScreenShell";

// /tests/:code (PLM.7 · `Test Run.dc.html`) — a single test run. The FROZEN config
// snapshot is the hero: rendered verbatim from TestRun.configSnapshot, never a live
// re-resolve — a result is inseparable from the config it ran on. DETAIL screen →
// full breadcrumbs. Org-scoped via getTestRun → dbForOrg.
export const dynamic = "force-dynamic";

export default async function TestRunPage({
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
            Sign in to view this test run.
          </p>
        </ScreenMessage>
      </ScreenShell>
    );
  }

  const run = await getTestRun(user.orgId, code);
  if (!run) {
    return (
      <ScreenShell header={<Header code={code} />}>
        <ScreenMessage>
          <p className="text-sm text-ink-muted">
            No test run <span className="font-mono">{code}</span> in this
            workspace.
          </p>
        </ScreenMessage>
      </ScreenShell>
    );
  }

  const connected = await getConnectedObjects(user.orgId, "TEST_RUN", code);
  const history = await recordHistoryFor(user.orgId, "TEST_RUN", code);
  const attachments = await attachmentsFor(user.orgId, "TEST_RUN", code);
  return (
    <TestRunView
      run={run}
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
        Quality · test run
      </div>
      <h1 className="mt-0.5 font-mono text-[19px] font-semibold tracking-[-0.02em] text-ink">
        {code}
      </h1>
    </div>
  );
}
