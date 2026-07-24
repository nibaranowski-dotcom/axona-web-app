import { dbForOrg } from "@axona/db";
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
