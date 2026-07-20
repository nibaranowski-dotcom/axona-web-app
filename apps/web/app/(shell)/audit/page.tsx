import { getCurrentUser } from "@/lib/session";
import {
  getAuditFilterOptions,
  getAuditRollup,
  getAuditTrail,
  getCalibration,
} from "@/lib/audit-trail";
import { AuditView, type AuditScreenData } from "@/components/audit/AuditView";

// /audit (build-spec §5/§8) — the Governance audit-trail viewer (AUDIT.2). Read-only
// over the append-only AuditLog; org-scoped. Cross-cutting route → the global Axona
// pane stays. The log is immutable (AUDIT.1 rules) — the UI offers no edit/delete.
export const dynamic = "force-dynamic";

const EMPTY: AuditScreenData = {
  entries: [],
  nextCursor: null,
  rollup: {
    total: 0,
    agentActions: 0,
    humanDecisions: 0,
    approvals: 0,
    lowConfidence: 0,
  },
  options: { actorTypes: [], actions: [], targetTypes: [] },
  calibration: null,
};

export default async function AuditPage() {
  const user = await getCurrentUser();
  if (!user) return <AuditView data={EMPTY} />;
  try {
    const [page, rollup, options, calibration] = await Promise.all([
      getAuditTrail(user.orgId),
      getAuditRollup(user.orgId),
      getAuditFilterOptions(user.orgId),
      getCalibration(user.orgId), // CONF.1 — the org's reliability model
    ]);
    return <AuditView data={{ ...page, rollup, options, calibration }} />;
  } catch {
    return <AuditView data={EMPTY} error />;
  }
}
