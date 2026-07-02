import { getCurrentUser } from "@/lib/session";
import { listTelemetry } from "@/lib/fleet";

// GET /api/fleet/telemetry?robotId=&cursor=&take= — org-scoped telemetry list
// (paginated). Read-only.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ items: [], nextCursor: null });
  const url = new URL(req.url);
  const robotId = url.searchParams.get("robotId") ?? undefined;
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const takeRaw = url.searchParams.get("take");
  const take = takeRaw ? Number(takeRaw) : undefined;
  return Response.json(
    await listTelemetry(user.orgId, {
      robotId,
      cursor,
      take: Number.isFinite(take) ? take : undefined,
    }),
  );
}
