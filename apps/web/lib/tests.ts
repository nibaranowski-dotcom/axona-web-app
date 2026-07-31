import { dbForOrg } from "@axona/db";
import type { FrozenConfigSnapshot } from "@axona/db";
import type {
  TestStep,
  TestRunRow,
  TestProcedureGroup,
  TestFacets,
  TestFilters,
  TestExplorerData,
  TestRunDetail,
  CompareCell,
  CompareData,
} from "./tests-types";

// PLM.6/PLM.7 — the test-traceability read model. Read-only over the PLM.1b
// TestRun/TestResult models. Every "config at run" comes from the run's FROZEN
// configSnapshot (never a live re-resolve) — a test result is inseparable from the
// config it ran on. Org-scoped via dbForOrg. Types live in ./tests-types (no
// server imports) so client components share them; re-exported here for callers.
export type {
  TestStep,
  TestRunRow,
  TestProcedureGroup,
  TestFacets,
  TestFilters,
  TestExplorerData,
  TestRunDetail,
  CompareCell,
  CompareData,
} from "./tests-types";

const FILTER_KEYS = ["procedure", "config", "unit", "outcome"] as const;

function snapOf(v: unknown): FrozenConfigSnapshot | null {
  return v && typeof v === "object" ? (v as FrozenConfigSnapshot) : null;
}

/** The procedure code — "Actuator torque test · SBX-B" → "TP-114"-style label. */
function procedureCode(procedure: string): string {
  const map: Record<string, string> = {
    "Actuator torque test": "TP-114",
    "Payload load test": "TP-207",
    "Payload endurance": "TP-114",
    "Acceptance · full": "TP-001",
  };
  const base = procedure.replace(/\s·\sSBX-B$/, "");
  return map[base] ?? "TP-000";
}

/** Headline measurement string from a run's steps (the failing step leads). */
function keyMeasurement(steps: TestStep[]): { text: string; bad: boolean } {
  if (steps.length === 0) return { text: "—", bad: false };
  const fail = steps.find((s) => !s.passed);
  const s = fail ?? steps[0]!;
  if (s.measurement === null)
    return { text: s.passed ? "in spec" : "out", bad: !s.passed };
  const val = `${s.measurement}${s.unitOfMeasure ? ` ${s.unitOfMeasure}` : ""}`;
  if (fail && s.upperLimit != null && s.measurement > s.upperLimit) {
    const pct =
      Math.round(((s.measurement - s.upperLimit) / s.upperLimit) * 1000) / 10;
    return { text: `${val} · +${pct}%`, bad: true };
  }
  return { text: `${val} · in spec`, bad: false };
}

function toRow(
  code: string,
  serial: string,
  procedure: string,
  outcome: string,
  startedAt: Date,
  snap: FrozenConfigSnapshot | null,
  steps: TestStep[],
): TestRunRow {
  const key = keyMeasurement(steps);
  return {
    code,
    serial,
    procedure,
    configVersion: snap?.configVersion?.name ?? null,
    swVersion: snap?.sw?.version ?? null,
    keyMeasurement: key.text,
    keyBad: key.bad,
    outcome,
    startedAt,
  };
}

/**
 * The Test Explorer (PLM.6): every run grouped by procedure, filterable + the
 * facet options. Config-at-run comes from each run's frozen snapshot.
 */
export async function getTestExplorer(
  orgId: string,
  filters: TestFilters = {},
): Promise<TestExplorerData> {
  const db = dbForOrg(orgId);
  const runs = await db.testRun.findMany({
    include: { unit: { select: { serial: true } }, results: true },
    orderBy: { startedAt: "desc" },
  });

  const all = runs.map((r) => {
    const snap = snapOf(r.configSnapshot);
    return {
      row: toRow(
        r.code,
        r.unit.serial,
        r.procedure,
        r.outcome,
        r.startedAt,
        snap,
        r.results,
      ),
      raw: r,
    };
  });

  // Facets from the FULL set (options never vanish as you filter).
  const facets: TestFacets = {
    procedure: [...new Set(all.map((a) => a.row.procedure))].sort(),
    config: [
      ...new Set(
        all.map((a) => a.row.configVersion).filter(Boolean) as string[],
      ),
    ].sort(),
    unit: [...new Set(all.map((a) => a.row.serial))].sort(),
    outcome: [...new Set(all.map((a) => a.row.outcome))].sort(),
  };

  const q = filters.q?.trim().toLowerCase();
  const matches = all.filter((a) => {
    const r = a.row;
    if (filters.procedure && r.procedure !== filters.procedure) return false;
    if (filters.config && r.configVersion !== filters.config) return false;
    if (filters.unit && r.serial !== filters.unit) return false;
    if (filters.outcome && r.outcome !== filters.outcome) return false;
    if (q && !`${r.code} ${r.serial} ${r.procedure}`.toLowerCase().includes(q))
      return false;
    return true;
  });

  // Group by procedure.
  const byProc = new Map<string, TestRunRow[]>();
  for (const a of matches) {
    const list = byProc.get(a.row.procedure) ?? [];
    list.push(a.row);
    byProc.set(a.row.procedure, list);
  }
  const groups: TestProcedureGroup[] = [...byProc.entries()]
    .map(([procedure, rows]) => {
      const fails = rows.filter((r) => r.outcome === "fail").length;
      return {
        procedure,
        code: procedureCode(procedure),
        stat: `${rows.length} run${rows.length === 1 ? "" : "s"} · ${fails} fail`,
        runs: rows,
      };
    })
    .sort((a, b) => a.procedure.localeCompare(b.procedure));

  return { groups, facets, total: all.length, matched: matches.length };
}

export { FILTER_KEYS as TEST_FILTER_KEYS };

/** A single Test Run (PLM.7). The frozen snapshot is rendered verbatim. */
export async function getTestRun(
  orgId: string,
  code: string,
): Promise<TestRunDetail | null> {
  const db = dbForOrg(orgId);
  const run = await db.testRun.findFirst({
    where: { code },
    include: {
      unit: { select: { serial: true } },
      results: { orderBy: { step: "asc" } },
    },
  });
  if (!run) return null;

  // VERIFY.3 — the linked NCR is rendered on the run page, so pin the pick.
  const ncrRow = await db.nCR.findFirst({
    where: { testRunId: run.id },
    orderBy: { code: "asc" },
  });
  const steps: TestStep[] = run.results.map((s) => ({
    step: s.step,
    measurement: s.measurement,
    unitOfMeasure: s.unitOfMeasure,
    lowerLimit: s.lowerLimit,
    upperLimit: s.upperLimit,
    passed: s.passed,
  }));

  return {
    code: run.code,
    serial: run.unit.serial,
    procedure: run.procedure,
    procedureCode: procedureCode(run.procedure),
    outcome: run.outcome,
    startedAt: run.startedAt,
    operatorLabel: run.operatorId,
    steps,
    stepFailCount: steps.filter((s) => !s.passed).length,
    snapshot: snapOf(run.configSnapshot),
    environment:
      run.environment && typeof run.environment === "object"
        ? (run.environment as Record<string, unknown>)
        : null,
    ncr: ncrRow
      ? {
          code: ncrRow.code,
          defect: ncrRow.defect,
          rootCause: ncrRow.rootCause,
        }
      : null,
    asBuiltHref: `/units/${encodeURIComponent(run.unit.serial)}/as-built`,
    unitHref: `/units/${encodeURIComponent(run.unit.serial)}`,
  };
}

/**
 * Compare 2+ runs (PLM.6 compare mode) — the whole point: makes "how the builds
 * differed" visible. Config deltas come from each run's FROZEN snapshot.
 */
export async function compareTestRuns(
  orgId: string,
  codes: string[],
): Promise<CompareData> {
  const db = dbForOrg(orgId);
  const runs = await db.testRun.findMany({
    where: { code: { in: codes } },
    include: { unit: { select: { serial: true } }, results: true },
  });
  // preserve the requested order
  const ordered = codes
    .map((c) => runs.find((r) => r.code === c))
    .filter((r): r is (typeof runs)[number] => !!r);

  const snaps = ordered.map((r) => snapOf(r.configSnapshot));

  const cell = (key: string, values: (string | null)[]): CompareCell => ({
    key,
    values,
    differs: new Set(values.map((v) => v ?? "∅")).size > 1,
  });

  const config: CompareCell[] = [
    cell(
      "Config version",
      snaps.map((s) => s?.configVersion?.name ?? null),
    ),
    cell(
      "Software",
      snaps.map((s) => s?.sw?.version ?? null),
    ),
  ];
  // per-position hw across the snapshots
  const positions = [
    ...new Set(snaps.flatMap((s) => (s?.hw ?? []).map((h) => h.position))),
  ].sort();
  for (const pos of positions) {
    config.push(
      cell(
        `HW ${pos}`,
        snaps.map((s) => {
          const line = (s?.hw ?? []).find((h) => h.position === pos);
          return line
            ? `${line.partNumber} ${line.rev}${line.lotCode ? ` · lot ${line.lotCode}` : ""}`
            : null;
        }),
      ),
    );
  }

  // measurement deltas per shared step
  const steps = [
    ...new Set(ordered.flatMap((r) => r.results.map((s) => s.step))),
  ].sort();
  const measurements: CompareCell[] = steps.map((step) =>
    cell(
      step,
      ordered.map((r) => {
        const s = r.results.find((x) => x.step === step);
        if (!s || s.measurement === null) return null;
        return `${s.measurement}${s.unitOfMeasure ? ` ${s.unitOfMeasure}` : ""} · ${s.passed ? "pass" : "fail"}`;
      }),
    ),
  );

  return {
    runs: ordered.map((r) => ({
      code: r.code,
      serial: r.unit.serial,
      outcome: r.outcome,
      configVersion: snapOf(r.configSnapshot)?.configVersion?.name ?? null,
    })),
    config,
    measurements,
  };
}
