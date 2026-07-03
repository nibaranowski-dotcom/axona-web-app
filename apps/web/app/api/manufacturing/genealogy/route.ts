import { getCurrentUser } from "@/lib/session";
import { getGenealogy } from "@/lib/manufacturing";

// GET /api/manufacturing/genealogy?serial= — a single unit's as-built station
// trace (the serial is the genealogy anchor; parts·serials·firmware = ONT.2).
// Read-only.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ serial: "", steps: [] });
  const serial = new URL(req.url).searchParams.get("serial");
  if (!serial) return Response.json({ serial: "", steps: [] });
  return Response.json(await getGenealogy(user.orgId, serial));
}
