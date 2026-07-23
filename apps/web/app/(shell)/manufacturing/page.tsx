import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { hasRole } from "@/lib/rbac";
import {
  getManufacturingData,
  getGenealogy,
  getAsBuiltCapture,
} from "@/lib/manufacturing";
import {
  MfgView,
  type MfgScreenData,
} from "@/components/manufacturing/MfgView";

// /manufacturing (build-spec §4.11) — the MES line-flow + build-genealogy screen.
// Data from MFG.1 getManufacturingData + getGenealogy (org-scoped), read-only.
// Static shell route → precedence over (shell)/[module].
export const dynamic = "force-dynamic";

const HELD = new Set(["HOLD", "HALT", "HALTED", "BLOCKED"]);

const EMPTY: MfgScreenData = {
  lineFlow: [],
  throughput: { built: 0, inProgress: 0, onHold: 0, total: 0, oeePct: null },
  bottlenecks: [],
  genealogySerial: "",
  genealogySteps: [],
  heldSerial: null,
  capture: null,
  canCapture: false,
  traceLines: [],
};

export default async function ManufacturingPage({
  searchParams,
}: {
  searchParams?: { serial?: string };
}) {
  const user = await getCurrentUser();
  if (!user) return <MfgView data={EMPTY} />;

  try {
    const db = dbForOrg(user.orgId);
    const [mfg, latestRun] = await Promise.all([
      getManufacturingData(user.orgId),
      db.agentRun.findFirst({
        where: { agent: { moduleKey: "manufacturing", orgId: user.orgId } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // The genealogy focus is the held unit (the defect story) by default —
    // overridable via ?serial=. lineFlow carries each unit's current position.
    const current = mfg.lineFlow.flatMap((s) => s.workOrders);
    const heldSerial =
      current.find((w) => HELD.has(w.status.toUpperCase()))?.serial ?? null;
    const genealogySerial =
      searchParams?.serial ?? heldSerial ?? current[0]?.serial ?? "";
    const [{ steps }, capture] = await Promise.all([
      genealogySerial
        ? getGenealogy(user.orgId, genealogySerial)
        : Promise.resolve({ steps: [] }),
      genealogySerial
        ? getAsBuiltCapture(user.orgId, genealogySerial)
        : Promise.resolve(null),
    ]);

    const traceLines = Array.isArray(latestRun?.trace)
      ? (latestRun.trace as { ts?: string; kind?: string; text?: string }[])
      : [];

    return (
      <MfgView
        data={{
          ...mfg,
          genealogySerial,
          genealogySteps: steps,
          heldSerial,
          capture,
          canCapture: hasRole(user, ["OPS", "ADMIN", "ENGINEER"]),
          traceLines,
        }}
      />
    );
  } catch {
    return <MfgView data={EMPTY} error />;
  }
}
