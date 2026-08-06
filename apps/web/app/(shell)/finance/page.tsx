import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { getFocusedRecord } from "@/lib/connected-objects";
import { FocusedRecord } from "@/components/ontology/FocusedRecord";
import { hasRole } from "@/lib/rbac";
import { approvalRoles } from "@/lib/approvals";
import { getFinanceData } from "@/lib/finance";
import {
  FinanceView,
  type FinanceScreenData,
} from "@/components/finance/FinanceView";

// /finance (build-spec §4.20) — Finance & Accounting: the two-revenue-engine P&L,
// per-unit economics, and AR aging. Data from FIN.1 getFinanceData (org-scoped),
// read-only. Static shell route → precedence over (shell)/[module].
export const dynamic = "force-dynamic";

const EMPTY: FinanceScreenData = {
  revenueSplit: { total: 0, hardware: 0, raas: 0, streams: [] },
  revenueByPeriod: [],
  unitEconomics: [],
  invoices: [],
  rollup: {
    recognizedRevenue: 0,
    cogs: 0,
    opex: 0,
    netIncome: 0,
    arTotal: 0,
    arOverdue: 0,
    cash: null,
    runwayMonths: null,
  },
  traceLines: [],
};

export default async function FinancePage({
  searchParams,
}: {
  searchParams?: { focus?: string | string[] };
}) {
  const user = await getCurrentUser();
  if (!user) return <FinanceView data={EMPTY} />;

  try {
    const db = dbForOrg(user.orgId);
    const [finance, latestRun] = await Promise.all([
      getFinanceData(user.orgId),
      db.agentRun.findFirst({
        where: { agent: { moduleKey: "finance", orgId: user.orgId } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const traceLines = Array.isArray(latestRun?.trace)
      ? (latestRun.trace as { ts?: string; kind?: string; text?: string }[])
      : [];

    // LINK.2 — a LINK.1 hop arrives with ?focus=<code>; resolve it so the record is
    // surfaced instead of the visitor landing on a bare list (a soft dead-end).
    const focused = await getFocusedRecord(
      user.orgId,
      "INVOICE",
      searchParams?.focus,
      async (code) => {
        const r = await db.invoice.findFirst({
          where: { code },
          select: { account: true, status: true },
        });
        return r ? `${r.status} · ${r.account}` : null;
      },
    );
    return (
      <>
        {focused && (
          <FocusedRecord
            type={focused.type}
            code={focused.code}
            label={focused.label}
            groups={focused.groups}
            basePath="/finance"
          />
        )}
        <FinanceView
          data={{
            ...finance,
            traceLines,
            canIssueCredit: hasRole(user, approvalRoles("creditnote.issue")),
          }}
        />
      </>
    );
  } catch {
    return <FinanceView data={EMPTY} error />;
  }
}
