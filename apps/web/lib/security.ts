import { dbForOrg, paginateArgs, pageResult } from "@axona/db";
import type { Severity } from "@axona/db";
import { getFleetData } from "./fleet";
import { getEngineeringData } from "./engineering";

// SEC.1 — Security read/API layer (build-spec §4.22). The connected-robot attack
// surface. Read-only over the existing CVE model (no schema change): CVEs by
// severity/status + a derived device posture (over the FLEET.1 robots) + the
// signed-firmware patch rollout (joined to ENG.1 firmware releases + the cert
// gate). Org-scoped via dbForOrg; the CVE list paginated with the FND.11 helpers.
//
// Through-line: at least one CVE affects deployed units and its fix is the
// signed-firmware patch (v4.2.2-rc) that must clear ENGINEERING's cert gate.
//
// MOAT / gating: patch rollouts + access changes are agent-DRAFTED/proposed only.
/// RBAC.4: the rollout/access state machine — Engineering's cert gate is the
/// approval owner; a human approves before any unit is touched.
/// AUDIT.3: each proposal logs inputs·output·model·confidence·approver to the
/// immutable event log. Do not add those columns here.

const CVE_CAP = 500;
const DEGRADED = new Set(["FAULT", "OFFLINE"]);

export interface SecurityCve {
  id: string;
  code: string;
  severity: Severity;
  affectedUnits: number;
  status: string;
  affectsDeployed: boolean; // affectedUnits > 0
}
export interface PostureBucket {
  bucket: string; // Hardened / Needs patch / Degraded
  count: number;
}
export interface PatchRollout {
  version: string; // the signed-firmware patch (e.g. v4.2.2-rc)
  note: string;
  firmwareState: string; // RC / RELEASED / MAINT (from ENG)
  certGate: string; // cert / in-test / pending — Engineering's gate
  gated: boolean; // not yet cert-cleared → cannot roll out
  targetUnits: number; // units the patch addresses (from the CVE it fixes)
  forCve: string | null; // the CVE this patch resolves
}
export interface SecurityRollup {
  bySeverity: { severity: string; count: number }[];
  byStatus: { status: string; count: number }[];
  unitsAffected: number;
  postureSpread: PostureBucket[];
  openRollouts: number; // gated (in-flight) patch rollouts
}
export interface SecurityData {
  cves: SecurityCve[];
  devicePosture: PostureBucket[];
  patchRollouts: PatchRollout[];
  rollup: SecurityRollup;
}

const CVE_SELECT = {
  id: true,
  code: true,
  severity: true,
  affectedUnits: true,
  status: true,
} as const;

const POSTURE_ORDER = ["Hardened", "Needs patch", "Degraded"];

function countBy<T>(items: T[], key: (t: T) => string) {
  const m = new Map<string, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return [...m.entries()];
}

/**
 * Everything the Security screen (SEC.2) needs, org-scoped and read-only: CVEs
 * (severity/status, deployed-unit exposure), the device posture spread derived
 * over the FLEET.1 robots, and the signed-firmware patch rollout(s) joined to
 * ENG.1 firmware releases + the cert gate, plus a rollup.
 */
export async function getSecurityData(orgId: string): Promise<SecurityData> {
  // Compose over the sibling read models rather than re-deriving (FLEET.1 posture
  // source, ENG.1 firmware + cert gate). Each is org-scoped via dbForOrg.
  const [cveRows, fleet, eng] = await Promise.all([
    dbForOrg(orgId).cVE.findMany({
      orderBy: [{ severity: "desc" }, { code: "desc" }],
      take: CVE_CAP,
      select: CVE_SELECT,
    }),
    getFleetData(orgId),
    getEngineeringData(orgId),
  ]);

  const cves: SecurityCve[] = cveRows.map((c) => ({
    ...c,
    affectsDeployed: c.affectedUnits > 0,
  }));

  // Device posture — derived over the fleet (no DevicePosture model). A unit is
  // Degraded if fault/offline, Needs-patch if behind the latest released
  // firmware, else Hardened.
  const latestReleased =
    eng.firmwareReleases
      .filter((f) => f.state.toUpperCase() === "RELEASED")
      .map((f) => f.version)
      .sort()
      .reverse()[0] ?? null;
  const postureOf = (r: { firmware: string; status: string }) => {
    if (DEGRADED.has(r.status.toUpperCase())) return "Degraded";
    if (latestReleased && r.firmware !== latestReleased) return "Needs patch";
    return "Hardened";
  };
  const devicePosture: PostureBucket[] = countBy(fleet.robots, postureOf)
    .map(([bucket, count]) => ({ bucket, count }))
    .sort(
      (a, b) =>
        POSTURE_ORDER.indexOf(a.bucket) - POSTURE_ORDER.indexOf(b.bucket),
    );

  // Patch rollouts — the RC (release-candidate) signed firmware is the fix; it
  // carries Engineering's cert gate (CompatCell cert / in-test). It addresses the
  // largest deployed-unit CVE still in PATCH_DRAFTED.
  const draftedCve = cves
    .filter((c) => c.status.toUpperCase() === "PATCH_DRAFTED")
    .sort((a, b) => b.affectedUnits - a.affectedUnits)[0];
  const patchRollouts: PatchRollout[] = eng.firmwareReleases
    .filter((f) => f.state.toUpperCase() === "RC")
    .map((fw) => {
      // Firmware releases carry an -rc suffix (v4.2.2-rc); compat cells use the
      // base version (v4.2.2) — match on the base to resolve the cert gate.
      const base = fw.version.replace(/-.*$/, "");
      const cells = eng.compatMatrix.cells.filter(
        (c) => c.fwVersion === base || c.fwVersion === fw.version,
      );
      const certGate = cells.some((c) => c.state === "cert")
        ? "cert"
        : cells.some((c) => c.state === "in-test")
          ? "in-test"
          : "pending";
      return {
        version: fw.version,
        note: fw.note,
        firmwareState: fw.state,
        certGate,
        gated: certGate !== "cert",
        targetUnits: draftedCve?.affectedUnits ?? 0,
        forCve: draftedCve?.code ?? null,
      };
    });

  return {
    cves,
    devicePosture,
    patchRollouts,
    rollup: {
      bySeverity: countBy(cves, (c) => c.severity)
        .map(([severity, count]) => ({ severity, count }))
        .sort((a, b) => b.count - a.count),
      byStatus: countBy(cves, (c) => c.status)
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
      unitsAffected: cves.reduce((n, c) => n + c.affectedUnits, 0),
      postureSpread: devicePosture,
      openRollouts: patchRollouts.filter((p) => p.gated).length,
    },
  };
}

/** Paginated CVE list (read-only), optionally filtered by status / severity. */
export async function listCves(
  orgId: string,
  opts: {
    status?: string;
    severity?: string;
    cursor?: string;
    take?: number;
  } = {},
) {
  const take = opts.take ?? 50;
  const rows = await dbForOrg(orgId).cVE.findMany({
    where: {
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.severity ? { severity: opts.severity as Severity } : {}),
    },
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: CVE_SELECT,
  });
  const { items, nextCursor } = pageResult(rows, take);
  return {
    items: items.map((c) => ({ ...c, affectsDeployed: c.affectedUnits > 0 })),
    nextCursor,
  };
}
