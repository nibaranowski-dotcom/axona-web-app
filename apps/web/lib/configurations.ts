import {
  dbForOrg,
  resolveConfigManifest,
  readConfigManifest,
  type ConfigManifest,
  type ConfigHwPosition,
  type ConfigSwItem,
} from "@axona/db";
import { resolveConfigSummaries } from "./units";

// PLM.10 — the Configurations read model (`Configurations.dc.html`). Answers Q2 at
// fleet level: the named ConfigurationVersions with resolved hw + sw content,
// baseline/lock state, and a MATCHING-UNITS count (units whose resolved config is
// this one — the same rule the registry uses, so the count equals /units filtered
// by that config). Lock/baseline is gated via decide("config.lock"). Org-scoped.

export interface ConfigRow {
  id: string;
  name: string;
  model: string;
  hw: Record<string, string>;
  sw: Record<string, string>;
  isBaseline: boolean;
  locked: boolean;
  lockedAt: string | null;
  matchingUnits: number;
  matchingHref: string;
}
export interface ConfigDiffRow {
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

function asMap(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object") return {};
  return Object.fromEntries(
    Object.entries(v as Record<string, unknown>).map(([k, val]) => [
      k,
      String(val),
    ]),
  );
}

export async function getConfigurations(orgId: string): Promise<ConfigRow[]> {
  const db = dbForOrg(orgId);
  const [configs, units] = await Promise.all([
    db.configurationVersion.findMany({
      include: { productModel: { select: { code: true } } },
      orderBy: { name: "asc" },
    }),
    db.unit.findMany({ select: { serial: true } }),
  ]);

  // matching-units count from the SAME resolution the registry uses.
  const summaries = await resolveConfigSummaries(
    orgId,
    units.map((u) => u.serial),
  );
  const countByConfig = new Map<string, number>();
  for (const s of summaries.values())
    if (s.configVersion)
      countByConfig.set(
        s.configVersion,
        (countByConfig.get(s.configVersion) ?? 0) + 1,
      );

  return configs.map((c) => ({
    id: c.id,
    name: c.name,
    model: c.productModel.code,
    hw: asMap(c.hwSpec),
    sw: asMap(c.swSpec),
    isBaseline: c.isBaseline,
    locked: c.lockedAt !== null,
    lockedAt: c.lockedAt
      ? new Date(c.lockedAt).toISOString().slice(0, 10)
      : null,
    matchingUnits: countByConfig.get(c.name) ?? 0,
    matchingHref: `/units?config=${encodeURIComponent(c.name)}`,
  }));
}

/** Diff two configuration versions — hw + sw deltas (the flag drives the highlight). */
export async function compareConfigs(
  orgId: string,
  nameA: string,
  nameB: string,
): Promise<ConfigDiff | null> {
  const db = dbForOrg(orgId);
  const [a, b] = await Promise.all([
    db.configurationVersion.findFirst({ where: { name: nameA } }),
    db.configurationVersion.findFirst({ where: { name: nameB } }),
  ]);
  if (!a || !b) return null;

  const diff = (
    ma: Record<string, string>,
    mb: Record<string, string>,
  ): ConfigDiffRow[] => {
    const keys = [...new Set([...Object.keys(ma), ...Object.keys(mb)])].sort();
    return keys.map((key) => {
      const va = ma[key] ?? null;
      const vb = mb[key] ?? null;
      return { key, a: va, b: vb, differs: va !== vb };
    });
  };

  return {
    a: a.name,
    b: b.name,
    hw: diff(asMap(a.hwSpec), asMap(b.hwSpec)),
    sw: diff(asMap(a.swSpec), asMap(b.swSpec)),
  };
}

// ── PLM.11 · Configuration DETAIL (`Configuration.dc.html`) ─────────────────────

export type ConfigState = "draft" | "baseline" | "superseded";

export interface ConfigLineageNode {
  name: string;
  state: ConfigState;
  current: boolean;
  href: string;
}
export interface ConfigChangeRow {
  code: string;
  title: string;
  effectivity: string;
  stage: string;
  href: string;
}
export interface ConfigApprover {
  role: string;
  who: string;
}
export interface ConfigAgentProposal {
  /**
   * DEMO-INTEGRITY (SEED.4) — no confidence field. This carried a hardcoded 0.82
   * literal rendered as "Proposal · 82% confidence", which was the SAME fabricated
   * constant the RCA screen used. A number appears here only once it is a real
   * `calibratedConfidence()` result (DEMO.6 beat #6).
   */
  text: string;
}
export interface ConfigDetail {
  id: string;
  code: string;
  model: string;
  state: ConfigState;
  frozen: boolean;
  baselinedAt: string | null;
  manifest: ConfigManifest;
  matchingUnits: number;
  totalUnits: number;
  matchingHref: string;
  lineage: ConfigLineageNode[];
  supersedesNote: string | null;
  diff: ConfigDiff | null;
  compareOptions: string[];
  changes: ConfigChangeRow[];
  approvers: ConfigApprover[];
  related: { label: string; meta: string; href: string }[];
  agent: ConfigAgentProposal | null;
  /** dual-approver lock proposed but not yet finalized (awaiting a second approver). */
  lockAwaitingSecond: boolean;
  /** PLM.13 — the as-designed BOM for this configuration's model (`/bom/:model`). */
  bomHref: string;
}

function stateOf(c: {
  lockedAt: Date | null;
  supersededBy: { lockedAt: Date | null }[];
}): ConfigState {
  if (c.supersededBy.some((s) => s.lockedAt !== null)) return "superseded";
  return c.lockedAt !== null ? "baseline" : "draft";
}

/**
 * The full Configuration detail for `code`, org-scoped. The manifest is FROZEN for a
 * baseline (immutability) and resolved LIVE for a draft. Matching-units + the version
 * diff reuse the existing registry/compare logic (no parallel query). PLM.11.
 */
export async function getConfigurationDetail(
  orgId: string,
  code: string,
): Promise<ConfigDetail | null> {
  const db = dbForOrg(orgId);
  const config = await db.configurationVersion.findFirst({
    where: { name: code },
    include: {
      productModel: { select: { id: true, code: true } },
      supersedes: {
        select: {
          name: true,
          lockedAt: true,
          supersededBy: { select: { lockedAt: true } },
        },
      },
      supersededBy: { select: { name: true, lockedAt: true } },
    },
  });
  if (!config) return null;

  // Manifest — live for a draft, the frozen snapshot for a baseline (immutable).
  const liveManifest = await resolveConfigManifest(db, {
    productModelId: config.productModelId,
    swSpec: config.swSpec,
  });
  const { manifest, frozen } = readConfigManifest({
    lockedAt: config.lockedAt,
    frozenManifest: config.frozenManifest,
    liveManifest,
  });

  const state = stateOf(config);

  // Matching-units — the SAME resolution the registry filter uses (no duplication).
  const allUnits = await db.unit.findMany({ select: { serial: true } });
  const summaries = await resolveConfigSummaries(
    orgId,
    allUnits.map((u) => u.serial),
  );
  let matchingUnits = 0;
  for (const s of summaries.values())
    if (s.configVersion === config.name) matchingUnits++;

  // Lineage — predecessor → this → successor(s).
  const lineage: ConfigLineageNode[] = [];
  if (config.supersedes) {
    lineage.push({
      name: config.supersedes.name,
      state: stateOf(config.supersedes),
      current: false,
      href: `/configurations/${encodeURIComponent(config.supersedes.name)}`,
    });
  }
  lineage.push({
    name: config.name,
    state,
    current: true,
    href: `/configurations/${encodeURIComponent(config.name)}`,
  });
  for (const s of config.supersededBy) {
    lineage.push({
      name: s.name,
      state: s.lockedAt ? "baseline" : "draft",
      current: false,
      href: `/configurations/${encodeURIComponent(s.name)}`,
    });
  }
  const supersedesNote = config.supersedes
    ? `Supersedes ${config.supersedes.name}${config.supersededBy[0] ? ` · succeeded by ${config.supersededBy[0].name}` : ""}`
    : config.supersededBy[0]
      ? `Succeeded by ${config.supersededBy[0].name}`
      : null;

  // Version diff — reuse compareConfigs; default = vs the predecessor baseline.
  const modelConfigs = await db.configurationVersion.findMany({
    where: { productModelId: config.productModelId },
    select: { name: true },
    orderBy: { name: "asc" },
  });
  const compareOptions = modelConfigs
    .map((c) => c.name)
    .filter((n) => n !== config.name);
  const defaultCompare = config.supersedes?.name ?? compareOptions[0] ?? null;
  const diff = defaultCompare
    ? await compareConfigs(orgId, defaultCompare, config.name)
    : null;

  // Change history — the ECOs in this org (link into the Change Order detail, PLM.9).
  const ecos = await db.eCO.findMany({
    orderBy: { code: "desc" },
    take: 6,
  });
  const changes: ConfigChangeRow[] = ecos.map((e) => ({
    code: e.code,
    title: e.title,
    effectivity: e.effectiveFromSerial
      ? `From ${e.effectiveFromSerial}`
      : "Fleet-wide",
    stage: e.stage,
    href: `/changes/${encodeURIComponent(e.code)}`,
  }));

  // Approvers — the two people on the (dual-approver) baseline.
  const approverIds = [config.lockProposedById, config.lockedById].filter(
    (x): x is string => !!x,
  );
  const users = approverIds.length
    ? await db.user.findMany({
        where: { id: { in: approverIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const nameOf = (id: string | null) => {
    if (!id) return null;
    const u = users.find((x) => x.id === id);
    return u?.name ?? u?.email ?? null;
  };
  const approvers: ConfigApprover[] = [];
  if (nameOf(config.lockProposedById))
    approvers.push({
      role: "Baselined by",
      who: nameOf(config.lockProposedById)!,
    });
  if (nameOf(config.lockedById))
    approvers.push({ role: "Approved by", who: nameOf(config.lockedById)! });

  return {
    id: config.id,
    code: config.name,
    model: config.productModel.code,
    state,
    frozen,
    baselinedAt: config.lockedAt
      ? new Date(config.lockedAt).toISOString().slice(0, 10)
      : null,
    manifest,
    matchingUnits,
    totalUnits: allUnits.length,
    matchingHref: `/units?config=${encodeURIComponent(config.name)}`,
    lineage,
    supersedesNote,
    diff,
    compareOptions,
    changes,
    approvers,
    related: [
      {
        // PLM.13 — the BOM screen exists now; this lands on the model's tree.
        label: "BOM · as-designed",
        meta: config.productModel.code,
        href: `/bom/${encodeURIComponent(config.productModel.code)}`,
      },
      {
        label: "Test runs on this config",
        meta: `${matchingUnits} units`,
        href: "/tests",
      },
      {
        label: "Blast radius",
        meta: `${matchingUnits} units`,
        href: "/blast-radius",
      },
      { label: "Compat matrix", meta: "HW ↔ FW", href: "/engineering" },
    ],
    // Agent seam — drift proposal (assistance only; the screen is usable with it off).
    agent:
      state === "baseline"
        ? {
            text: "Units on this baseline may show drift — verify no field swaps went uncaptured as a configuration change.",
          }
        : null,
    lockAwaitingSecond:
      config.lockedAt === null && config.lockProposedById !== null,
    // PLM.13 — was a stub to the Engineering hub until the BOM screen existed.
    bomHref: `/bom/${encodeURIComponent(config.productModel.code)}`,
  };
}

export type { ConfigHwPosition, ConfigSwItem, ConfigManifest };
