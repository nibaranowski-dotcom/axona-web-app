// PLM.6/PLM.7 — the client-safe half of the test-traceability module: types only.
// lib/tests.ts imports @axona/db (→ node:fs), so client components import types
// from here instead, and the server module re-exports these (one definition each).
// The FrozenConfigSnapshot import is type-only (erased at build) — no runtime dep.
import type { FrozenConfigSnapshot } from "@axona/db";

export type { FrozenConfigSnapshot };

export interface TestStep {
  step: string;
  measurement: number | null;
  unitOfMeasure: string | null;
  lowerLimit: number | null;
  upperLimit: number | null;
  passed: boolean;
}

export interface TestRunRow {
  code: string;
  serial: string;
  procedure: string;
  configVersion: string | null;
  swVersion: string | null;
  keyMeasurement: string;
  keyBad: boolean;
  outcome: string;
  startedAt: Date;
}

export interface TestProcedureGroup {
  procedure: string;
  code: string;
  stat: string;
  runs: TestRunRow[];
}

export interface TestFacets {
  procedure: string[];
  config: string[];
  unit: string[];
  outcome: string[];
}

export interface TestFilters {
  q?: string;
  procedure?: string;
  config?: string;
  unit?: string;
  outcome?: string;
}

export interface TestExplorerData {
  groups: TestProcedureGroup[];
  facets: TestFacets;
  total: number;
  matched: number;
}

export interface TestRunDetail {
  code: string;
  serial: string;
  procedure: string;
  procedureCode: string;
  outcome: string;
  startedAt: Date;
  operatorLabel: string | null;
  steps: TestStep[];
  stepFailCount: number;
  /** The FROZEN snapshot for the signature panel (immutable, at run time). */
  snapshot: FrozenConfigSnapshot | null;
  environment: Record<string, unknown> | null;
  /** The NCR this run triggered, if any (link target — RCA is PLM.8). */
  ncr: { code: string; defect: string; rootCause: string | null } | null;
  asBuiltHref: string;
  unitHref: string;
}

export interface CompareCell {
  key: string;
  values: (string | null)[];
  differs: boolean;
}
export interface CompareData {
  runs: {
    code: string;
    serial: string;
    outcome: string;
    configVersion: string | null;
  }[];
  config: CompareCell[];
  measurements: CompareCell[];
}
