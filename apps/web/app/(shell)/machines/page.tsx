import { getCurrentUser } from "@/lib/session";
import { getMachinesData } from "@/lib/machines";
import {
  MachinesView,
  type MachinesScreenData,
} from "@/components/machines/MachinesView";

// /machines (build-spec §4.9) — the plant & equipment register. Data from MACH.1
// getMachinesData (org-scoped), read-only. Static shell route → precedence over
// (shell)/[module].
export const dynamic = "force-dynamic";

const EMPTY: MachinesScreenData = {
  groups: [],
  rollup: {
    total: 0,
    byStatus: [],
    running: 0,
    maintenance: 0,
    idle: 0,
    needsService: 0,
    avgUtilization: 0,
    telemetryOnline: 0,
  },
};

export default async function MachinesPage() {
  const user = await getCurrentUser();
  if (!user) return <MachinesView data={EMPTY} />;

  try {
    const data = await getMachinesData(user.orgId);
    return <MachinesView data={data} />;
  } catch {
    return <MachinesView data={EMPTY} error />;
  }
}
