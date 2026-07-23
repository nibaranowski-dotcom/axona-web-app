import { dbForOrg, paginateArgs, pageResult } from "@axona/db";
import type { Severity, FrozenConfigSnapshot } from "@axona/db";

// QUAL.1 — Quality read/API layer (build-spec §4.13, §6). Read-only over the
// existing models (SpcSample / NCR / Cert): no schema change, no mutations (the
// SPC control-chart + NCR tracker screen is QUAL.2). Everything org-scoped via
// dbForOrg; lists paginated with the FND.11 helpers; the UCL/LCL column compare
// uses $queryRaw with orgId pinned.

const SPC_SAMPLE_CAP = 500;
const CERT_EXPIRY_WINDOW_DAYS = 90;

export interface SpcPoint {
  value: number;
  ucl: number;
  lcl: number;
  mean: number;
  ts: Date;
  serial: string;
}
export interface SpcSeries {
  characteristic: string;
  ucl: number;
  lcl: number;
  mean: number;
  breach: boolean; // any point outside the control limits
  points: SpcPoint[];
}
export interface QualityNcr {
  id: string;
  code: string;
  defect: string;
  linkedTo: string;
  severity: Severity;
  status: string;
  // PLM.V2 — RCA classification + the test run that triggered it.
  rootCause: string | null;
  triggeredByRun: string | null;
  triggeredByHref: string | null;
}
/** PLM.V2 — a test-traceability row (per-unit verification, distinct from SPC). */
export interface TestTraceRow {
  code: string;
  serial: string;
  procedure: string;
  configVersion: string | null;
  outcome: string;
  href: string;
}
/** The RCA root-cause taxonomy (matches the RootCause enum). */
export const ROOT_CAUSES = [
  "software",
  "hardware",
  "design",
  "production",
  "component",
  "field_modification",
] as const;
export interface QualityCert {
  id: string;
  name: string;
  scope: string;
  validTo: Date;
  status: string;
  expiring: boolean; // validTo within the expiry window
  auditReady: boolean; // valid and not expiring
}
export interface DefectParetoBar {
  defect: string;
  count: number;
}
export interface QualityData {
  spcSeries: SpcSeries[];
  ncrs: QualityNcr[];
  certs: QualityCert[];
  defectPareto: DefectParetoBar[];
  // PLM.V2 — per-unit test traceability (kept DISTINCT from SPC process monitoring).
  testTrace: TestTraceRow[];
}

/**
 * Everything the Quality screen (QUAL.2) needs, org-scoped and read-only:
 * - spcSeries: SpcSample points grouped by characteristic, ordered by ts, with a
 *   per-characteristic breach flag (value > ucl OR value < lcl, via $queryRaw).
 * - ncrs: open NCRs, CRITICAL first.
 * - certs: CE/UL/ISO with computed expiring / audit-ready flags.
 * - defectPareto: NCR counts grouped by defect, descending.
 */
export async function getQualityData(orgId: string): Promise<QualityData> {
  const db = dbForOrg(orgId);

  const [samples, breachRows, ncrRows, certRows, paretoRows] =
    await Promise.all([
      db.spcSample.findMany({
        orderBy: [{ characteristic: "asc" }, { ts: "asc" }],
        take: SPC_SAMPLE_CAP,
        select: {
          characteristic: true,
          serial: true,
          value: true,
          ucl: true,
          lcl: true,
          mean: true,
          ts: true,
        },
      }),
      // Out-of-control compare needs a column comparison — raw SQL, orgId pinned.
      db.$queryRaw<{ characteristic: string; breaches: number }[]>`
      SELECT characteristic, COUNT(*)::int AS breaches
        FROM "SpcSample"
        WHERE "orgId" = ${orgId} AND (value > ucl OR value < lcl)
        GROUP BY characteristic`,
      db.nCR.findMany({
        where: { status: { not: "CLOSED" } },
        orderBy: [{ severity: "desc" }, { code: "asc" }], // CRITICAL first
        take: 200,
        select: {
          id: true,
          code: true,
          defect: true,
          linkedTo: true,
          severity: true,
          status: true,
          rootCause: true, // PLM.V2
          testRunId: true, // PLM.V2 — the run that triggered it
        },
      }),
      db.cert.findMany({
        orderBy: { validTo: "asc" },
        take: 200,
        select: {
          id: true,
          name: true,
          scope: true,
          validTo: true,
          status: true,
        },
      }),
      db.nCR.groupBy({
        by: ["defect"],
        _count: { defect: true },
        orderBy: { _count: { defect: "desc" } },
      }),
    ]);

  const breachByChar = new Map(
    breachRows.map((r) => [r.characteristic, Number(r.breaches) > 0]),
  );

  // Group the (ts-ordered) samples into per-characteristic series.
  const seriesMap = new Map<string, SpcSeries>();
  for (const s of samples) {
    let series = seriesMap.get(s.characteristic);
    if (!series) {
      series = {
        characteristic: s.characteristic,
        ucl: s.ucl,
        lcl: s.lcl,
        mean: s.mean,
        breach: breachByChar.get(s.characteristic) ?? false,
        points: [],
      };
      seriesMap.set(s.characteristic, series);
    }
    series.points.push({
      value: s.value,
      ucl: s.ucl,
      lcl: s.lcl,
      mean: s.mean,
      ts: s.ts,
      serial: s.serial,
    });
  }

  const cutoff = Date.now() + CERT_EXPIRY_WINDOW_DAYS * 24 * 3600 * 1000;
  const certs: QualityCert[] = certRows.map((c) => {
    const expiring = c.validTo.getTime() <= cutoff;
    return { ...c, expiring, auditReady: c.status === "VALID" && !expiring };
  });

  const defectPareto: DefectParetoBar[] = paretoRows.map((r) => ({
    defect: r.defect,
    count: r._count.defect,
  }));

  // ── PLM.V2 — test traceability + NCR trigger resolution ───────────────────
  // Recent per-unit test runs (DISTINCT from SPC): config-at-run from the frozen
  // snapshot, so this section reads the same immutable copy the Test Run page does.
  const testRuns = await db.testRun.findMany({
    include: { unit: { select: { serial: true } } },
    orderBy: { startedAt: "desc" },
    take: 6,
  });
  const testTrace: TestTraceRow[] = testRuns.map((r) => {
    const snap =
      r.configSnapshot && typeof r.configSnapshot === "object"
        ? (r.configSnapshot as unknown as FrozenConfigSnapshot)
        : null;
    return {
      code: r.code,
      serial: r.unit.serial,
      procedure: r.procedure,
      configVersion: snap?.configVersion?.name ?? null,
      outcome: r.outcome,
      href: `/tests/${encodeURIComponent(r.code)}`,
    };
  });

  // Resolve each NCR's triggering test run (testRunId → code) in one batch.
  const runIds = [
    ...new Set(ncrRows.map((n) => n.testRunId).filter(Boolean) as string[]),
  ];
  const runById = new Map(
    (runIds.length
      ? await db.testRun.findMany({
          where: { id: { in: runIds } },
          select: { id: true, code: true },
        })
      : []
    ).map((r) => [r.id, r.code]),
  );
  const ncrs: QualityNcr[] = ncrRows.map((n) => {
    const runCode = n.testRunId ? (runById.get(n.testRunId) ?? null) : null;
    return {
      id: n.id,
      code: n.code,
      defect: n.defect,
      linkedTo: n.linkedTo,
      severity: n.severity,
      status: n.status,
      rootCause: n.rootCause,
      triggeredByRun: runCode,
      triggeredByHref: runCode ? `/tests/${encodeURIComponent(runCode)}` : null,
    };
  });

  return {
    spcSeries: [...seriesMap.values()],
    ncrs,
    certs,
    defectPareto,
    testTrace,
  };
}

/** Paginated SPC samples (read-only), optionally filtered by characteristic. */
export async function listSpc(
  orgId: string,
  opts: { characteristic?: string; cursor?: string; take?: number } = {},
) {
  const take = opts.take ?? 100;
  const rows = await dbForOrg(orgId).spcSample.findMany({
    where: opts.characteristic ? { characteristic: opts.characteristic } : {},
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: {
      id: true,
      characteristic: true,
      serial: true,
      value: true,
      ucl: true,
      lcl: true,
      mean: true,
      ts: true,
    },
  });
  return pageResult(rows, take);
}

/** Paginated NCR list (read-only), optionally filtered by status. */
export async function listNcrs(
  orgId: string,
  opts: { status?: string; cursor?: string; take?: number } = {},
) {
  const take = opts.take ?? 50;
  const rows = await dbForOrg(orgId).nCR.findMany({
    where: opts.status ? { status: opts.status } : {},
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: {
      id: true,
      code: true,
      defect: true,
      linkedTo: true,
      severity: true,
      status: true,
    },
  });
  return pageResult(rows, take);
}

/** Paginated cert list (read-only). */
export async function listCerts(
  orgId: string,
  opts: { cursor?: string; take?: number } = {},
) {
  const take = opts.take ?? 50;
  const rows = await dbForOrg(orgId).cert.findMany({
    orderBy: { id: "asc" },
    ...paginateArgs({ cursor: opts.cursor, take }),
    select: {
      id: true,
      name: true,
      scope: true,
      validTo: true,
      status: true,
    },
  });
  return pageResult(rows, take);
}
