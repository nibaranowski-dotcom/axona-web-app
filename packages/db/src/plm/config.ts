import { leafOnly } from "./bom";
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
      orderBy: { name: "asc" }, // VERIFY.3 — stable pick when two configs match
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

// ── PLM.11 · the Configuration MANIFEST (the config-detail hero) ────────────────
// A named config's resolved content: HW positions (from the product model's BOM) +
// SW items (from swSpec). A DRAFT resolves this live; a BASELINE freezes it at lock
// time into ConfigurationVersion.frozenManifest and renders THAT — so changing an
// underlying part revision can never alter a baselined manifest (immutability).

export interface ConfigHwPosition {
  position: string;
  name: string; // the part's human description
  partNumber: string;
  rev: string;
  qty: number;
}
export interface ConfigSwItem {
  kind: string; // FIRMWARE | POLICY | OS | CAL …
  name: string;
  version: string;
  certState: string; // "Certified" | "Current" | …
}
export interface ConfigManifest {
  hw: ConfigHwPosition[];
  sw: ConfigSwItem[];
  hwCount: number;
}

// swSpec key → (kind, display name, cert state). Presentational mapping — the config's
// swSpec stays a plain {key: version} map; unknown keys degrade to a sensible default.
const SW_KINDS: Record<string, { kind: string; name: string; cert: string }> = {
  firmware: { kind: "FIRMWARE", name: "Robot firmware", cert: "Certified" },
  policy: { kind: "POLICY", name: "Autonomy policy", cert: "Certified" },
  os: { kind: "OS", name: "Edge runtime", cert: "Certified" },
  cal: { kind: "CAL", name: "Calibration profile", cert: "Current" },
};

function swItemsFromSpec(swSpec: unknown): ConfigSwItem[] {
  if (!swSpec || typeof swSpec !== "object") return [];
  return Object.entries(swSpec as Record<string, unknown>).map(([key, ver]) => {
    const meta = SW_KINDS[key] ?? {
      kind: key.toUpperCase(),
      name: key,
      cert: "Current",
    };
    return {
      kind: meta.kind,
      name: meta.name,
      version: String(ver),
      certState: meta.cert,
    };
  });
}

/**
 * Resolve a named config's LIVE manifest — HW positions from the product model's BOM
 * (position → part revision → qty) + SW items from swSpec. Draft configs render this;
 * baselined configs render their frozen snapshot (see freezeConfigManifest). Org-scoped.
 */
export async function resolveConfigManifest(
  db: OrgScopedDb,
  config: { productModelId: string; swSpec: unknown },
): Promise<ConfigManifest> {
  // PLM.13: one design revision (the model's current) and leaves only. Without
  // the revision filter a model with a revision ladder returns every revision's
  // rows at once, and an assembly node is not an installable position.
  const manifestModel = await db.productModel.findUnique({
    where: { id: config.productModelId },
    select: { designRevision: true },
  });
  const bom = leafOnly(
    await db.bomLine.findMany({
      where: {
        productModelId: config.productModelId,
        designRevision: manifestModel?.designRevision,
      },
      include: { partRevision: { include: { partMaster: true } } },
      orderBy: { position: "asc" },
    }),
  );
  const hw: ConfigHwPosition[] = bom.map((b) => ({
    position: b.position,
    name: b.partRevision.partMaster.description,
    partNumber: b.partRevision.partMaster.partNumber,
    rev: b.partRevision.rev,
    qty: b.qty,
  }));
  return { hw, sw: swItemsFromSpec(config.swSpec), hwCount: hw.length };
}

/**
 * Materialize the config's manifest as a FROZEN snapshot to persist in
 * `frozenManifest` at lock time. Plain serializable object — never re-resolved on read.
 */
export async function freezeConfigManifest(
  db: OrgScopedDb,
  config: { productModelId: string; swSpec: unknown },
): Promise<ConfigManifest & { frozen: true; at: string }> {
  const m = await resolveConfigManifest(db, config);
  return { frozen: true, at: new Date().toISOString(), ...m };
}

/** Read a config's manifest: the frozen snapshot when baselined, else live. This is
 *  the single immutability boundary — a baselined manifest never re-resolves. */
export function readConfigManifest(config: {
  lockedAt: Date | null;
  frozenManifest: unknown;
  liveManifest: ConfigManifest;
}): { manifest: ConfigManifest; frozen: boolean } {
  if (config.lockedAt && config.frozenManifest) {
    const f = config.frozenManifest as Partial<ConfigManifest>;
    return {
      manifest: {
        hw: f.hw ?? [],
        sw: f.sw ?? [],
        hwCount: f.hwCount ?? f.hw?.length ?? 0,
      },
      frozen: true,
    };
  }
  return { manifest: config.liveManifest, frozen: false };
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
  const unit = await db.unit.findUnique({
    where: { id: unitId },
    include: { productModel: { select: { designRevision: true } } },
  });
  if (!unit) throw new Error(`Unit ${unitId} not found in this org`);

  // PLM.13: the model's current design revision, leaves only (see above).
  const bom = leafOnly(
    await db.bomLine.findMany({
      where: {
        productModelId: unit.productModelId,
        designRevision: unit.productModel.designRevision,
      },
      include: { partRevision: { include: { partMaster: true } } },
    }),
  );
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

// ── SRCH/AGT — the shared CONFIG COMPARISON ─────────────────────────────────────
//
// Lifted here from apps/web/lib/configurations.ts so the /configurations screen and
// the agent's `compareConfigurations` tool run the SAME diff. It was web-only, and
// packages/agents depends on @axona/db (not on apps/web), so the alternative was a
// second implementation of the same delta — the way two surfaces start disagreeing
// about what changed between two baselines.
//
// Why the agent needs it as a TOOL: asked "what changed between CFG-X and CFG-Y", it
// had only full-text search, which ANDs its terms — "changed"/"between" match no
// document, so the query returned nothing and the agent looped re-searching until it
// hit the turn cap and answered nothing at all. A positional delta is a PLM primitive,
// not a search result; giving it a tool is the fix, and it leaves global FTS alone.

export interface ConfigDiffRow {
  /** the HW position or SW item key. */
  key: string;
  a: string | null;
  b: string | null;
  differs: boolean;
}
export interface ConfigDiff {
  a: string;
  b: string;
  hw: ConfigDiffRow[];
  sw: ConfigDiffRow[];
}

/** Coerce a stored hw/sw spec (Json) into a flat key→value map. */
export function asSpecMap(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object") return {};
  return Object.fromEntries(
    Object.entries(v as Record<string, unknown>).map(([k, val]) => [
      k,
      String(val),
    ]),
  );
}

function diffMaps(
  ma: Record<string, string>,
  mb: Record<string, string>,
): ConfigDiffRow[] {
  const keys = [...new Set([...Object.keys(ma), ...Object.keys(mb)])].sort();
  return keys.map((key) => {
    const va = ma[key] ?? null;
    const vb = mb[key] ?? null;
    return { key, a: va, b: vb, differs: va !== vb };
  });
}

/**
 * Diff two configuration versions by NAME — positional hw + sw deltas.
 * Org-scoped via `dbForOrg`; returns null when either name is not this tenant's,
 * so a caller can never read another org's baseline.
 */
export async function compareConfigVersions(
  orgId: string,
  nameA: string,
  nameB: string,
): Promise<ConfigDiff | null> {
  const { dbForOrg } = await import("../client");
  const db = dbForOrg(orgId);
  const [a, b] = await Promise.all([
    db.configurationVersion.findFirst({ where: { name: nameA } }),
    db.configurationVersion.findFirst({ where: { name: nameB } }),
  ]);
  if (!a || !b) return null;
  return {
    a: a.name,
    b: b.name,
    hw: diffMaps(asSpecMap(a.hwSpec), asSpecMap(b.hwSpec)),
    sw: diffMaps(asSpecMap(a.swSpec), asSpecMap(b.swSpec)),
  };
}
