import {
  dbForOrg,
  resolveConfigManifest,
  readConfigManifest,
  getCalibrationModel,
  calibratedConfidence,
  type ConfigManifest,
  type ConfigHwPosition,
  type ConfigSwItem,
  // SRCH/AGT — the config diff now lives in @axona/db so the agent's
  // compareConfigurations tool runs the SAME comparison this screen shows.
  compareConfigVersions,
  asSpecMap,
  type ConfigDiff,
  type ConfigDiffRow,
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
// Re-exported so existing importers of this module keep working unchanged.
export type { ConfigDiff, ConfigDiffRow };

const asMap = asSpecMap;

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

/**
 * Diff two configuration versions — hw + sw deltas (the flag drives the highlight).
 * Delegates to the shared @axona/db implementation so this screen and the agent's
 * compareConfigurations tool can never disagree about what changed.
 */
export async function compareConfigs(
  orgId: string,
  nameA: string,
  nameB: string,
): Promise<ConfigDiff | null> {
  return compareConfigVersions(orgId, nameA, nameB);
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
/** DEMO.6 #6 — one fact the drift assessment is built from, rendered beside the
 *  score so the number can be checked rather than believed. */
export interface ConfigAgentSignal {
  key: string;
  detail: string;
  weight: number;
}

export interface ConfigAgentProposal {
  /**
   * The configuration agent's assessment of THIS baseline. Was a hardcoded seam
   * (static text + a literal 0.82 that SEED.4 removed); DEMO.6 #6 makes it a real
   * proposal computed from the units actually on this baseline.
   */
  text: string;
  /** What the agent proposes the human do — the action the Confirm control takes. */
  action: string;
  /** Derived from `signals`, never a literal. */
  rawConfidence: number;
  /** The CONF.1-corrected value — what the screen shows. */
  calibrated: number;
  calibratedState: "calibrated" | "uncalibrated";
  signals: ConfigAgentSignal[];
  /** The model that emitted it — carried onto the AUDIT.1 entry. */
  model: string;
  /** true when the agent found real drift (vs a clean baseline). */
  driftFound: boolean;
}

/** DEMO.6 #6 — the model that emits the configuration assessment. */
export const CONFIG_AGENT_MODEL = "claude-sonnet-4-6";
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
  const matchingSerials: string[] = [];
  for (const [serial, s] of summaries.entries())
    if (s.configVersion === config.name) {
      matchingUnits++;
      matchingSerials.push(serial);
    }

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

  // ── DEMO.6 #6 — the configuration agent's drift assessment ──────────────────
  // A baseline is only worth locking if the fleet actually MATCHES it. The agent
  // audits that: it reads the units resolving to this baseline and looks for
  // deviations that were never captured as a configuration change — an as-built
  // substitution, or a field modification applied after the lock. Both are real
  // rows, so the score is recomputable; there is no literal anywhere below.
  //
  // Only for a locked baseline: on a draft there is nothing to have drifted FROM,
  // and inventing an assessment there would be theatre.
  let agentProposal: ConfigAgentProposal | null = null;
  if (state === "baseline" && matchingSerials.length > 0) {
    const unitsOnBaseline = await db.unit.findMany({
      where: { serial: { in: matchingSerials } },
      select: { id: true, serial: true },
    });
    const unitIds = unitsOnBaseline.map((u) => u.id);

    const substituted = await db.asBuiltRecord.findMany({
      where: { unitId: { in: unitIds }, isSubstitution: true },
      select: { unitId: true },
    });
    const driftedUnits = new Set(substituted.map((r) => r.unitId)).size;

    const fieldMods = await db.fieldEvent.count({
      where: {
        unitId: { in: unitIds },
        kind: "field_modification" as never,
        ...(config.lockedAt ? { occurredAt: { gt: config.lockedAt } } : {}),
      },
    });

    const signals: ConfigAgentSignal[] = [];
    // 1. the baseline is frozen — the comparison has a fixed reference, so the
    //    assessment is against an immutable manifest rather than a moving target.
    if (frozen) {
      signals.push({
        key: "frozen-manifest",
        detail:
          "manifest frozen at lock — a fixed reference to compare against",
        weight: 0.3,
      });
    }
    // 2. units carrying an as-built substitution vs as-designed
    if (driftedUnits > 0) {
      signals.push({
        key: "as-built-substitutions",
        detail: `${driftedUnits} of ${matchingUnits} units carry an as-built substitution`,
        weight: Math.min(0.35, 0.09 * driftedUnits),
      });
    }
    // 3. field modifications applied since the lock
    if (fieldMods > 0) {
      signals.push({
        key: "post-lock-field-mods",
        detail: `${fieldMods} field modification(s) recorded after the lock`,
        weight: Math.min(0.2, 0.07 * fieldMods),
      });
    }
    // 4. a successor exists — the baseline is about to move, so a review is timely
    if (config.supersededBy.length > 0) {
      signals.push({
        key: "successor-pending",
        detail: `${config.supersededBy[0]!.name} supersedes this baseline`,
        weight: 0.15,
      });
    }
    // 5. fleet coverage — a baseline most units resolve to is worth auditing
    signals.push({
      key: "fleet-coverage",
      detail: `${matchingUnits} of ${allUnits.length} units resolve to this baseline`,
      weight: Math.min(
        0.15,
        0.15 * (matchingUnits / Math.max(1, allUnits.length)),
      ),
    });

    const raw = Math.max(
      0,
      Math.min(
        1,
        signals.reduce((s, x) => s + x.weight, 0),
      ),
    );
    const cal = calibratedConfidence(raw, await getCalibrationModel(orgId));
    const driftFound = driftedUnits > 0 || fieldMods > 0;
    // Say only what is actually true — a finding that reports "and 0 field
    // modifications" reads like a template, which is exactly the tell this beat
    // exists to remove.
    const found: string[] = [];
    if (driftedUnits > 0)
      found.push(
        `${driftedUnits} of ${matchingUnits} units deviate from the as-designed manifest`,
      );
    if (fieldMods > 0)
      found.push(
        `${fieldMods} field modification${fieldMods === 1 ? "" : "s"} landed after the lock`,
      );
    agentProposal = {
      text: driftFound
        ? `${found.join(" and ")} — not captured as a configuration change.`
        : `No uncaptured deviation: all ${matchingUnits} units on this baseline match the frozen manifest.`,
      action: driftFound
        ? "Confirm the drift review and route the deviations to a change order"
        : "Confirm the baseline is clean",
      rawConfidence: Math.round(raw * 100) / 100,
      calibrated: Math.round(cal.value * 100) / 100,
      calibratedState: cal.state,
      signals,
      model: CONFIG_AGENT_MODEL,
      driftFound,
    };
  }

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
    // DEMO.6 #6 — the configuration agent's real drift assessment (assistance only;
    // the screen is fully usable with it off). Computed above from the units actually
    // on this baseline, never a canned string.
    agent: agentProposal,
    lockAwaitingSecond:
      config.lockedAt === null && config.lockProposedById !== null,
    // PLM.13 — was a stub to the Engineering hub until the BOM screen existed.
    bomHref: `/bom/${encodeURIComponent(config.productModel.code)}`,
  };
}

export type { ConfigHwPosition, ConfigSwItem, ConfigManifest };
