import type { OrgScopedDb } from "../client";

// PLM.1a — the keystone resolvers over the Unit spine (L1 capture fidelity).
// resolveConfigAt answers "what was this unit running THEN"; asBuiltDiff answers
// "the same robot is not actually the same". Both read captured records only —
// nothing is reconstructed.

export interface ResolvedHwLine {
  position: string;
  partNumber: string;
  rev: string;
  lotCode: string | null;
  isSubstitution: boolean;
}

export interface ResolvedConfig {
  unitId: string;
  at: Date;
  hw: ResolvedHwLine[];
  sw: { component: string; version: string } | null;
  /// The ConfigurationVersion whose swSpec matches the resolved sw (if any). The
  /// screens surface its name/baseline; a null means "no named config matches".
  configVersion: { id: string; name: string; isBaseline: boolean } | null;
}

/**
 * Resolve a unit's hw (as-built) + sw (the UnitSoftwareState window covering
 * `at`) and match a ConfigurationVersion. Every "config-at-time" answer routes
 * here — the timeline, the test snapshot's basis, blast-radius effectivity.
 */
export async function resolveConfigAt(
  db: OrgScopedDb,
  unitId: string,
  at: Date,
): Promise<ResolvedConfig> {
  const unit = await db.unit.findUnique({ where: { id: unitId } });
  if (!unit) throw new Error(`Unit ${unitId} not found in this org`);

  // hw = the as-built records (captured, never reconstructed)
  const asBuilt = await db.asBuiltRecord.findMany({
    where: { unitId },
    include: { partRevision: { include: { partMaster: true } } },
    orderBy: { bomPosition: "asc" },
  });
  const hw: ResolvedHwLine[] = asBuilt.map((r) => ({
    position: r.bomPosition,
    partNumber: r.partRevision.partMaster.partNumber,
    rev: r.partRevision.rev,
    lotCode: r.lotCode,
    isSubstitution: r.isSubstitution,
  }));

  // sw = the software state whose [effectiveFrom, effectiveTo) window contains `at`
  const swState = await db.unitSoftwareState.findFirst({
    where: {
      unitId,
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
    },
    include: { softwareRelease: true },
    orderBy: { effectiveFrom: "desc" },
  });
  const sw = swState
    ? {
        component: swState.softwareRelease.component,
        version: swState.softwareRelease.version,
      }
    : null;

  // match a named ConfigurationVersion by resolved sw (swSpec.<component> === version)
  let configVersion: ResolvedConfig["configVersion"] = null;
  if (sw) {
    const candidates = await db.configurationVersion.findMany({
      where: { productModelId: unit.productModelId },
    });
    const match = candidates.find((c) => {
      const spec = (c.swSpec ?? {}) as Record<string, unknown>;
      return spec[sw.component] === sw.version;
    });
    if (match)
      configVersion = {
        id: match.id,
        name: match.name,
        isBaseline: match.isBaseline,
      };
  }

  return { unitId, at, hw, sw, configVersion };
}

/// PLM.1b — an IMMUTABLE, self-contained config snapshot. Written once into
/// TestRun.configSnapshot / FieldEvent.configSnapshot and NEVER recomputed on read
/// (a test result is inseparable from the config it ran on — safety-critical). It
/// is a plain serializable object, not a live query, so nothing downstream can
/// re-resolve it against the unit's CURRENT config.
export interface FrozenConfigSnapshot {
  frozen: true;
  unitId: string;
  serial: string;
  /// The instant the config was frozen (the test/event time).
  at: string;
  hw: ResolvedHwLine[];
  sw: { component: string; version: string } | null;
  configVersion: { id: string; name: string; isBaseline: boolean } | null;
}

/**
 * Materialize the unit's resolved config AT `at` as a frozen snapshot. Callers
 * persist the returned object verbatim into a `configSnapshot` Json column; it must
 * never be replaced by a live resolveConfigAt on read.
 */
export async function freezeConfigSnapshot(
  db: OrgScopedDb,
  unitId: string,
  at: Date,
): Promise<FrozenConfigSnapshot> {
  const unit = await db.unit.findUnique({
    where: { id: unitId },
    select: { serial: true },
  });
  if (!unit) throw new Error(`Unit ${unitId} not found in this org`);
  const resolved = await resolveConfigAt(db, unitId, at);
  return {
    frozen: true,
    unitId,
    serial: unit.serial,
    at: at.toISOString(),
    hw: resolved.hw,
    sw: resolved.sw,
    configVersion: resolved.configVersion,
  };
}

export interface AsBuiltDiffLine {
  position: string;
  expected: { partNumber: string; rev: string } | null; // as-designed
  actual: { partNumber: string; rev: string; lotCode: string | null } | null; // as-built
  isSubstitution: boolean;
}

export interface AsBuiltDiffResult {
  unitId: string;
  serial: string;
  lines: AsBuiltDiffLine[];
  summary: { positions: number; substitutions: number };
}

/**
 * Align a unit's as-built records against the as-designed BOM (by position).
 * Substitutions are the NORMAL case, not errors — the flag just says "this
 * position diverged from design".
 */
export async function asBuiltDiff(
  db: OrgScopedDb,
  unitId: string,
): Promise<AsBuiltDiffResult> {
  const unit = await db.unit.findUnique({ where: { id: unitId } });
  if (!unit) throw new Error(`Unit ${unitId} not found in this org`);

  const bom = await db.bomLine.findMany({
    where: { productModelId: unit.productModelId },
    include: { partRevision: { include: { partMaster: true } } },
  });
  const asBuilt = await db.asBuiltRecord.findMany({
    where: { unitId },
    include: { partRevision: { include: { partMaster: true } } },
  });

  const designed = new Map(bom.map((b) => [b.position, b]));
  const built = new Map(asBuilt.map((a) => [a.bomPosition, a]));
  const positions = [...new Set([...designed.keys(), ...built.keys()])].sort();

  const lines: AsBuiltDiffLine[] = positions.map((position) => {
    const d = designed.get(position);
    const a = built.get(position);
    // captured flag wins; fall back to a revision mismatch when both are present
    const isSubstitution =
      a?.isSubstitution ??
      (!!d && !!a && d.partRevisionId !== a.partRevisionId);
    return {
      position,
      expected: d
        ? {
            partNumber: d.partRevision.partMaster.partNumber,
            rev: d.partRevision.rev,
          }
        : null,
      actual: a
        ? {
            partNumber: a.partRevision.partMaster.partNumber,
            rev: a.partRevision.rev,
            lotCode: a.lotCode,
          }
        : null,
      isSubstitution,
    };
  });

  return {
    unitId,
    serial: unit.serial,
    lines,
    summary: {
      positions: lines.length,
      substitutions: lines.filter((l) => l.isSubstitution).length,
    },
  };
}
