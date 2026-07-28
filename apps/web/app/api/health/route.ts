import { NextResponse } from "next/server";

// GOLIVE.2a — liveness probe for the Railway healthcheck (railway.json →
// deploy.healthcheckPath = /api/health). Deliberately DEPENDENCY-FREE: it does not
// touch Postgres/Redis/R2, so a slow dependency at boot never fails the healthcheck
// and the release-phase `prisma migrate deploy` can run before the app must answer.
// (A deeper readiness check that pings the DB can be added later as /api/ready.)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "axona-web",
    time: new Date().toISOString(),
  });
}
