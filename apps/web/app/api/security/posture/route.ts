import { getCurrentUser } from "@/lib/session";
import { getSecurityData } from "@/lib/security";

// GET /api/security/posture — the derived device-posture spread + signed-firmware
// patch rollouts (cert-gated) + rollup. Read-only; posture is derived over the
// fleet, patch rollouts over Engineering firmware releases.
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({
      devicePosture: [],
      patchRollouts: [],
      rollup: null,
    });
  }
  const { devicePosture, patchRollouts, rollup } = await getSecurityData(
    user.orgId,
  );
  return Response.json({ devicePosture, patchRollouts, rollup });
}
