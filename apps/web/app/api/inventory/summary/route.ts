import { getCurrentUser } from "@/lib/session";
import { getInventoryData } from "@/lib/inventory";

// GET /api/inventory/summary — critical parts (days-of-cover), stock by location,
// edge caches, rollup. Read-only.
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return Response.json({
      criticalParts: [],
      stockByLocation: [],
      edgeCaches: [],
      rollup: null,
    });
  return Response.json(await getInventoryData(user.orgId));
}
