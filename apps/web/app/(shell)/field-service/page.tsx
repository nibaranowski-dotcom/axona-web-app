import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { getFieldServiceData } from "@/lib/field-service";
import {
  FieldServiceView,
  type FieldServiceScreenData,
} from "@/components/field-service/FieldServiceView";

// /field-service (build-spec §4.17) — the technician dispatch board. Read-only,
// data from FIELD.1 getFieldServiceData (org-scoped). Static shell route →
// precedence over (shell)/[module].
export const dynamic = "force-dynamic";

const EMPTY: FieldServiceScreenData = {
  workOrders: [],
  technicians: [],
  board: [],
  sla: { open: 0, dueSoon: 0, breached: 0 },
  traceLines: [],
};

export default async function FieldServicePage() {
  const user = await getCurrentUser();
  if (!user) return <FieldServiceView data={EMPTY} />;

  try {
    const db = dbForOrg(user.orgId);
    const [field, latestRun] = await Promise.all([
      getFieldServiceData(user.orgId),
      db.agentRun.findFirst({
        where: { agent: { moduleKey: "field-service", orgId: user.orgId } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const traceLines = Array.isArray(latestRun?.trace)
      ? (latestRun.trace as { ts?: string; kind?: string; text?: string }[])
      : [];

    return <FieldServiceView data={{ ...field, traceLines }} />;
  } catch {
    return <FieldServiceView data={EMPTY} error />;
  }
}
