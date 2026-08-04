import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { hasRole } from "@/lib/rbac";
import { getFieldServiceData } from "@/lib/field-service";
import { getFocusedRecord } from "@/lib/connected-objects";
import { FocusedRecord } from "@/components/ontology/FocusedRecord";
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
  fieldMods: [],
  recordForm: { units: [], softwareReleases: [] },
  traceLines: [],
  canRecord: false,
};

export default async function FieldServicePage({
  searchParams,
}: {
  searchParams?: { focus?: string | string[] };
}) {
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

    // DEMO.6 #10 — LINK.1 arrival point: a hop that reached a work order lands here
    // with ?focus=<code> and opens that record's connected objects.
    const focused = await getFocusedRecord(
      user.orgId,
      "WORK_ORDER",
      searchParams?.focus,
      async (code) =>
        (
          await db.workOrderField.findFirst({
            where: { code },
            select: { issue: true },
          })
        )?.issue ?? null,
    );

    const canRecord = hasRole(user, ["OPS", "ADMIN", "ENGINEER", "TECH"]);
    return (
      <>
        {focused && (
          <FocusedRecord
            type={focused.type}
            code={focused.code}
            label={focused.label}
            groups={focused.groups}
            basePath="/field-service"
          />
        )}
        <FieldServiceView data={{ ...field, traceLines, canRecord }} />
      </>
    );
  } catch {
    return <FieldServiceView data={EMPTY} error />;
  }
}
