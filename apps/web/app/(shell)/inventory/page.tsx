import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { getInventoryData } from "@/lib/inventory";
import {
  InventoryView,
  type InventoryScreenData,
} from "@/components/inventory/InventoryView";

// /inventory (build-spec §4.11b) — Inventory & Warehouse: stock-by-echelon,
// critical parts (cover vs build schedule), edge caches, inv-orchestrator trace.
// Read-only, data from INV.1 getInventoryData (org-scoped). Static shell route →
// precedence over (shell)/[module].
export const dynamic = "force-dynamic";

const EMPTY: InventoryScreenData = {
  criticalParts: [],
  stockByLocation: [],
  edgeCaches: [],
  partMaster: [],
  rollup: {
    criticalCount: 0,
    reorderNeeded: 0,
    reservedTotal: 0,
    sparesNearFleet: 0,
    totalValueUsd: 0,
  },
  traceLines: [],
};

export default async function InventoryPage() {
  const user = await getCurrentUser();
  if (!user) return <InventoryView data={EMPTY} />;

  try {
    const db = dbForOrg(user.orgId);
    const [inventory, latestRun] = await Promise.all([
      getInventoryData(user.orgId),
      db.agentRun.findFirst({
        where: { agent: { moduleKey: "inventory", orgId: user.orgId } },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const traceLines = Array.isArray(latestRun?.trace)
      ? (latestRun.trace as { ts?: string; kind?: string; text?: string }[])
      : [];
    return <InventoryView data={{ ...inventory, traceLines }} />;
  } catch {
    return <InventoryView data={EMPTY} error />;
  }
}
