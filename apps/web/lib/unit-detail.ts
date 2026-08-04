import {
  dbForOrg,
  resolveConfigAt,
  asBuiltDiff,
  computeBuildReadiness,
} from "@axona/db";
import type {
  AsBuiltDiffResult,
  ResolvedConfig,
  BuildReadiness,
} from "@axona/db";
import {
  buildAgentProposal,
  type AgentProposal,
  type AgentSignal,
} from "./agent-proposal";

// PLM.3 — the Unit page read model. The unit is the HERO OBJECT: identity, the
// configuration it is running NOW, how its as-built diverges from as-designed,
// and a lifecycle timeline where EVERY event carries the configuration this unit
// was running AT THAT MOMENT — not the current one.
//
// That last point is the whole product. A test that passed under firmware v4.1.0
// must keep saying v4.1.0 forever, even after the unit is upgraded; otherwise the
// record is a lie and the "same robot is not the same robot" question can't be
// answered. So every event resolves through resolveConfigAt(event.ts) — never
// resolveConfigAt(now) reused down the list.

export type TimelineKind = "build" | "change" | "test" | "field";

export interface TimelineEvent {
  ts: Date;
  kind: TimelineKind;
  title: string;
  detail: string;
  /** The configuration version resolved AT `ts` (null when none matches then). */
  configAt: string | null;
  swAt: string | null;
}

export interface UnitIssue {
  code: string;
  defect: string;
  severity: string;
  status: string;
  /** DEMO.5 — this NCR has a root-cause workspace worth opening (gates "Open RCA →"). */
  hasRca: boolean;
}

export interface UnitChangeOrder {
  code: string;
  title: string;
  stage: string;
  rolloutStatus: string;
  effectiveFromSerial: string | null;
  /** Does this unit fall inside the ECO's effectivity window? */
  appliesToThisUnit: boolean;
}

export interface UnitDetail {
  serial: string;
  modelCode: string;
  modelName: string;
  status: string;
  buildDate: Date | null;
  site: string | null;
  customer: string | null;
  isDeployed: boolean;

  current: ResolvedConfig;
  configBaselinedAt: Date | null;
  diff: AsBuiltDiffResult;
  /** BR.1 — build-readiness rollup (BOM × on-hand × open-PO coverage). */
  buildReadiness: BuildReadiness;
  /**
   * DEMO.6 #11 — the readiness agent's proposed NEXT ACTION. BR.1 already computes
   * the percentage and names the blockers; what was missing is anyone proposing what
   * to DO about them. Null when the build is unblocked — nothing to propose.
   */
  readinessAgent: AgentProposal | null;
  lotsInvolved: string[];
  /** The substituted positions, with the captured "why · who · when". */
  substitutions: {
    position: string;
    designed: string;
    built: string;
    reason: string | null;
    installedAt: Date;
    lotCode: string | null;
  }[];

  timeline: TimelineEvent[];
  issues: UnitIssue[];
  changeOrders: UnitChangeOrder[];

  /**
   * PLM.1b seam. TestRun / FieldEvent are not modelled yet, so the Unit page
   * renders those sections gracefully empty rather than faking rows. When PLM.1b
   * lands it fills these two lists and the timeline picks up `test`/`field` kinds
   * with no other change to this screen.
   */
  testRuns: { code: string; name: string; outcome: string }[];
  fieldEvents: { code: string; summary: string; ts: Date }[];
}

const CLOSED_NCR = new Set(["CLOSED", "RESOLVED", "CANCELLED"]);

export async function getUnitDetail(
  orgId: string,
  serial: string,
): Promise<UnitDetail | null> {
  const db = dbForOrg(orgId);
  const unit = await db.unit.findFirst({
    where: { serial },
    include: { productModel: true },
  });
  if (!unit) return null;

  const now = new Date();
  const [current, diff, buildReadiness, asBuiltRows, swStates, configs, links] =
    await Promise.all([
      resolveConfigAt(db, unit.id, now),
      asBuiltDiff(db, unit.id),
      // BR.1 — same `now` as the config resolution keeps the page internally consistent.
      computeBuildReadiness(db, unit.id, { now: now.getTime() }),
      db.asBuiltRecord.findMany({
        where: { unitId: unit.id },
        include: { partRevision: { include: { partMaster: true } } },
        orderBy: { bomPosition: "asc" },
      }),
      db.unitSoftwareState.findMany({
        where: { unitId: unit.id },
        include: { softwareRelease: true },
        orderBy: { effectiveFrom: "asc" },
      }),
      db.configurationVersion.findMany({
        where: { productModelId: unit.productModelId },
      }),
      // Everything the graph links to THIS unit (PLM.2 made a UNIT node the Unit).
      db.entityLink.findMany({
        where: {
          OR: [
            { toType: "UNIT", toId: unit.id },
            { fromType: "UNIT", fromId: unit.id },
          ],
        },
      }),
    ]);

  // ── linked issues + change orders, through the ontology graph ─────────────
  const otherEnd = (l: (typeof links)[number]) =>
    l.fromType === "UNIT"
      ? { type: l.toType, id: l.toId }
      : { type: l.fromType, id: l.fromId };
  const ncrIds = links
    .map(otherEnd)
    .filter((e) => e.type === "NCR")
    .map((e) => e.id);
  const ecoIds = links
    .map(otherEnd)
    .filter((e) => e.type === "ECO")
    .map((e) => e.id);

  const [ncrs, ecos] = await Promise.all([
    ncrIds.length
      ? db.nCR.findMany({ where: { id: { in: [...new Set(ncrIds)] } } })
      : Promise.resolve([]),
    ecoIds.length
      ? db.eCO.findMany({ where: { id: { in: [...new Set(ecoIds)] } } })
      : Promise.resolve([]),
  ]);

  const issues: UnitIssue[] = ncrs
    .filter((n) => !CLOSED_NCR.has(n.status.toUpperCase()))
    .map((n) => ({
      code: n.code,
      defect: n.defect,
      severity: n.severity,
      status: n.status,
      // DEMO.5 — raised from a failing test / carries a frozen config-at-failure.
      hasRca: !!(n.testRunId || n.configSnapshot),
    }));

  const changeOrders: UnitChangeOrder[] = ecos.map((e) => ({
    code: e.code,
    title: e.title,
    stage: e.stage,
    rolloutStatus: e.rolloutStatus,
    effectiveFromSerial: e.effectiveFromSerial,
    // Effectivity is "from this serial onward" — a unit built before it is out of
    // scope. Serial ordering is lexicographic on the shared prefix, which is what
    // "from SN-2210" means in practice.
    appliesToThisUnit:
      !e.effectiveFromSerial || unit.serial >= e.effectiveFromSerial,
  }));

  // ── config-at-time resolution, batched over this ONE unit ─────────────────
  // Same rule as resolveConfigAt, applied per timestamp: find the sw state whose
  // [effectiveFrom, effectiveTo) window contains ts, then match a named config.
  const swAt = (ts: Date): string | null => {
    const s = swStates.find(
      (x) =>
        x.effectiveFrom <= ts && (x.effectiveTo === null || x.effectiveTo > ts),
    );
    return s?.softwareRelease.version ?? null;
  };
  const configAt = (ts: Date): string | null => {
    const sw = swAt(ts);
    if (!sw) return null;
    const match = configs.find(
      (c) => (c.swSpec as Record<string, unknown> | null)?.["firmware"] === sw,
    );
    return match?.name ?? null;
  };

  // ── the lifecycle timeline ────────────────────────────────────────────────
  const events: TimelineEvent[] = [];
  const subs = diff.lines.filter((l) => l.isSubstitution);

  if (unit.buildDate) {
    events.push({
      ts: unit.buildDate,
      kind: "build",
      title: "Build completed",
      detail: `As-built captured against BOM rev ${unit.productModel.designRevision} — ${diff.summary.positions} positions, ${subs.length} substitution${subs.length === 1 ? "" : "s"} flagged.`,
      configAt: configAt(unit.buildDate),
      swAt: swAt(unit.buildDate),
    });
  }

  // Every software change is a config change — the events the whole "config at
  // that time" story rests on.
  for (const s of swStates) {
    // The first state is the build's software, already implied by the build row.
    if (
      unit.buildDate &&
      s.effectiveFrom.getTime() === unit.buildDate.getTime()
    )
      continue;
    events.push({
      ts: s.effectiveFrom,
      kind: "change",
      title: `Firmware ${s.softwareRelease.version}`,
      detail: s.softwareRelease.notes
        ? `Software update · ${s.softwareRelease.notes}.`
        : "Software update recorded against this unit.",
      configAt: configAt(s.effectiveFrom),
      swAt: s.softwareRelease.version,
    });
  }

  // A configuration being baselined/locked is a change in this unit's world when
  // it is the configuration this unit resolves to.
  for (const c of configs) {
    if (!c.lockedAt) continue;
    if (c.name !== current.configVersion?.name) continue;
    events.push({
      ts: c.lockedAt,
      kind: "change",
      title: `Baseline ${c.name}`,
      detail:
        "Configuration locked — this unit's hardware and software pinned.",
      configAt: configAt(c.lockedAt),
      swAt: swAt(c.lockedAt),
    });
  }

  // An ECO with effectivity that reaches this unit is a change on its timeline.
  for (const e of ecos) {
    if (!e.effectiveFromDate) continue;
    const applies =
      !e.effectiveFromSerial || unit.serial >= e.effectiveFromSerial;
    events.push({
      ts: e.effectiveFromDate,
      kind: "change",
      title: `${e.code} · ${e.title}`,
      detail: applies
        ? `Change effective from ${e.effectiveFromSerial ?? "all units"} — rollout ${e.rolloutStatus.replace("_", " ")}.`
        : `Change effective from ${e.effectiveFromSerial} — this unit is outside the effectivity window.`,
      configAt: configAt(e.effectiveFromDate),
      swAt: swAt(e.effectiveFromDate),
    });
  }

  // A unit's lifecycle starts when it was built. A change dated before that (an
  // ECO whose effectivity predates this serial) is real, but it is not an event
  // in THIS unit's life — its relevance shows up as the effectivity note on the
  // change order instead. Keeping it here would also render a "config at that
  // time" of "—", because the unit had no software state yet.
  const born = unit.buildDate?.getTime() ?? -Infinity;
  const timeline = events
    .filter((e) => e.ts.getTime() >= born)
    .sort((a, b) => a.ts.getTime() - b.ts.getTime());

  // ── the substitution detail the diff summary expands into ─────────────────
  const bySubPosition = new Map(asBuiltRows.map((r) => [r.bomPosition, r]));
  const substitutions = subs.map((l) => {
    const rec = bySubPosition.get(l.position);
    return {
      position: l.position,
      designed: l.expected
        ? `${l.expected.partNumber} rev ${l.expected.rev}`
        : "not in BOM",
      built: l.actual
        ? `${l.actual.partNumber} rev ${l.actual.rev}`
        : "not installed",
      reason: rec?.note ?? null,
      installedAt: rec?.installedAt ?? unit.buildDate ?? new Date(0),
      lotCode: l.actual?.lotCode ?? null,
    };
  });

  const lotsInvolved = [
    ...new Set(
      asBuiltRows.map((r) => r.lotCode).filter((c): c is string => !!c),
    ),
  ].sort();

  const baselineConfig = configs.find(
    (c) => c.name === current.configVersion?.name,
  );

  // ── DEMO.6 #11 — the readiness agent's next action ──────────────────────────
  // BR.1 names WHAT is blocking; the agent proposes what to do about it. The
  // distinction that matters to a buyer: a blocker with a covering PO needs
  // EXPEDITING, one without needs ORDERING — different actions, and the screen
  // previously made the reader work that out.
  const blockers = buildReadiness.blockingParts;
  const late = blockers.filter((b) => b.state === "late");
  const missing = blockers.filter((b) => b.state === "missing");
  const readinessSignals: AgentSignal[] = [];
  if (blockers.length > 0)
    readinessSignals.push({
      key: "blocking-parts",
      detail: `${blockers.length} part(s) block the build at ${buildReadiness.pctInHouse}% in-house`,
      weight: Math.min(0.35, 0.18 * blockers.length),
    });
  if (late.length > 0)
    readinessSignals.push({
      key: "late-with-cover",
      detail: `${late.length} late, covered by ${
        late
          .map((b) => b.coveringPo)
          .filter(Boolean)
          .join(", ") || "an open order"
      } — expedite`,
      weight: 0.25,
    });
  if (missing.length > 0)
    readinessSignals.push({
      key: "missing-no-cover",
      detail: `${missing.length} with no covering order — needs raising`,
      weight: 0.3,
    });
  const singleSourced = blockers.filter((b) => b.tracked).length;
  if (singleSourced > 0)
    readinessSignals.push({
      key: "tracked-blockers",
      detail: `${singleSourced} blocker(s) tracked against the as-designed BOM`,
      weight: 0.1,
    });

  const readinessAgent =
    blockers.length > 0
      ? await buildAgentProposal(orgId, {
          text: `Build is ${buildReadiness.pctInHouse}% in-house; ${blockers.map((b) => b.partNumber).join(" and ")} ${blockers.length === 1 ? "blocks" : "block"} completion.`,
          action:
            missing.length > 0 && late.length > 0
              ? `Expedite ${late
                  .map((b) => b.coveringPo)
                  .filter(Boolean)
                  .join(
                    ", ",
                  )} and raise an order for ${missing.map((b) => b.partNumber).join(", ")}`
              : missing.length > 0
                ? `Raise an order for ${missing.map((b) => b.partNumber).join(", ")}`
                : `Expedite ${
                    late
                      .map((b) => b.coveringPo)
                      .filter(Boolean)
                      .join(", ") || "the covering order"
                  }`,
          signals: readinessSignals,
        })
      : null;

  return {
    serial: unit.serial,
    modelCode: unit.productModel.code,
    modelName: unit.productModel.name,
    status: unit.status,
    buildDate: unit.buildDate,
    site: unit.siteLabel,
    customer: unit.customerLabel,
    isDeployed: !!unit.robotId,

    current,
    configBaselinedAt: baselineConfig?.lockedAt ?? null,
    diff,
    buildReadiness,
    readinessAgent,
    lotsInvolved,
    substitutions,

    timeline,
    issues,
    changeOrders,

    // PLM.1b — real entities land here; until then the sections render empty.
    testRuns: [],
    fieldEvents: [],
  };
}
