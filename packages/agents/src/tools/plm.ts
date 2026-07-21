import type { OrgScopedDb } from "@axona/db";
import { getBlastRadius } from "./ontology";

// PLM.1a — the typed "which units are affected" façade. For an ECO it reuses the
// ONT.1 blast-radius traversal (the cross-module ripple), then resolves the UNIT
// nodes (whose code = serial) to the first-class Unit spine. For a lot / part
// revision / software release it queries the captured records directly (the
// precise "which units carry this" answer). Lives here (not @axona/db) because
// getBlastRadius depends on @axona/db — a db-side façade would cycle.

export interface AffectedUnit {
  id: string;
  serial: string;
  status: string;
  siteLabel: string | null;
  customerLabel: string | null;
  path?: string; // the ONT.1 relation path that reached it (ECO case)
}
export interface AffectedUnitsResult {
  source: "blast-radius" | "as-built" | "software-state";
  units: AffectedUnit[];
}

export async function affectedUnits(
  db: OrgScopedDb,
  opts: {
    ecoId?: string; // ECO code (e.g. "ECO-318")
    lot?: string; // lot code (e.g. "88421")
    partRevisionId?: string;
    softwareReleaseId?: string;
  },
): Promise<AffectedUnitsResult> {
  // ── ECO → units, via the ONT.1 graph (the required "via ONT.1" path) ──
  if (opts.ecoId) {
    const blast = await getBlastRadius(db, {
      entityType: "ECO",
      code: opts.ecoId,
      maxDepth: 4,
    });
    const unitNodes = blast.groups
      .flatMap((g) => g.nodes)
      .filter((n) => n.type === "UNIT");
    const bySerial = new Map(unitNodes.map((n) => [n.code, n.path]));
    const units = await db.unit.findMany({
      where: { serial: { in: [...bySerial.keys()] } },
    });
    return {
      source: "blast-radius",
      units: units.map((u) => ({
        id: u.id,
        serial: u.serial,
        status: u.status,
        siteLabel: u.siteLabel,
        customerLabel: u.customerLabel,
        path: bySerial.get(u.serial),
      })),
    };
  }

  // ── lot / part revision → units that carry it (as-built capture) ──
  if (opts.lot || opts.partRevisionId) {
    const records = await db.asBuiltRecord.findMany({
      where: opts.lot
        ? { lotCode: opts.lot }
        : { partRevisionId: opts.partRevisionId },
      include: { unit: true },
    });
    const seen = new Map<string, AffectedUnit>();
    for (const r of records)
      if (!seen.has(r.unitId))
        seen.set(r.unitId, {
          id: r.unit.id,
          serial: r.unit.serial,
          status: r.unit.status,
          siteLabel: r.unit.siteLabel,
          customerLabel: r.unit.customerLabel,
        });
    return { source: "as-built", units: [...seen.values()] };
  }

  // ── software release → units that ran/run it ──
  if (opts.softwareReleaseId) {
    const states = await db.unitSoftwareState.findMany({
      where: { softwareReleaseId: opts.softwareReleaseId },
      include: { unit: true },
    });
    const seen = new Map<string, AffectedUnit>();
    for (const s of states)
      if (!seen.has(s.unitId))
        seen.set(s.unitId, {
          id: s.unit.id,
          serial: s.unit.serial,
          status: s.unit.status,
          siteLabel: s.unit.siteLabel,
          customerLabel: s.unit.customerLabel,
        });
    return { source: "software-state", units: [...seen.values()] };
  }

  return { source: "as-built", units: [] };
}
