/**
 * DEMO.7 — SCRIPT FIDELITY. The types for a prospect's spoken-claim manifest.
 *
 * `verify:demo` already answers "does every link resolve and every screen render".
 * This answers a different question that no gate covered: **does the number the
 * presenter SAYS OUT LOUD match the number on the screen behind them.**
 *
 * That gap is not hypothetical. Two spoken lines were already false of the seed —
 * a part described as sitting in five locations sat in two, and an order described as
 * "seven days late" was six. Both would have been discovered live, mid-sentence, by
 * the person least able to recover from it.
 *
 * MARQUE-FREE (SEED.1): this file is committed, so it names no tenant, no prospect and
 * no hero code. Every claim is data supplied by a gitignored
 * `prospects/<p>/script.manifest.ts`, which MAY name its tenant because it is never
 * committed — the same split `verify:demo`'s walkthrough manifest uses.
 */

/** A single thing the presenter says, expressed as something the seed can be asked. */
export type SpokenClaim =
  /** a unit exists and its as-built capture is populated */
  | { kind: "unit.populated"; serial: string; minAsBuiltLines?: number }
  /** the as-built diff carries at least N agent-flagged substitutions */
  | { kind: "unit.driftFlagged"; serial: string; atLeast?: number }
  /** a test run's outcome */
  | { kind: "test.outcome"; code: string; equals: "pass" | "fail" }
  /** an NCR carries an agent-proposed cause + a confidence + a bound suspect part/lot */
  | { kind: "rca.proposedCause"; code: string; boundTo?: string }
  /** an ECO exists and its blast reaches at least N units */
  | { kind: "eco.blastUnits"; code: string; atLeast: number }
  /** a configuration is a locked baseline with two DIFFERENT approvers */
  | { kind: "config.dualApprovedBaseline"; name: string }
  /** a part's on-hand and minimum, as spoken ("zero on hand against a min of eight") */
  | { kind: "part.stockLevel"; sku: string; onHand: number; minLevel: number }
  /** the part is stocked across at least N distinct named locations */
  | { kind: "part.locationSpread"; sku: string; atLeast: number }
  /** a PO's status, and whether an agent drafted it */
  | { kind: "po.status"; code: string; equals: string; agentDrafted?: boolean }
  /** a PO is at least N days past its promised date */
  | { kind: "po.daysPastPromised"; code: string; atLeast: number }
  /** a goods-receipt three-way match: PO qty == received qty, with the invoice bound */
  | {
      kind: "po.threeWayMatch";
      code: string;
      qty: number;
      invoiceCode: string;
      capturedSerial: string;
    }
  /** each hop of a chain resolves (work order → unit → part → PO) */
  | {
      kind: "chain.resolves";
      workOrder: string;
      unitSerial: string;
      unitCustomer?: string;
      partSku: string;
      poCode: string;
    }
  /** build readiness reads exactly this percentage, blocked on exactly N parts */
  | {
      kind: "unit.buildReadiness";
      serial: string;
      pctInHouse: number;
      blockingParts: number;
    };

export interface ScriptManifest {
  /** the tenant's org id (this file is gitignored, so naming it is fine). */
  orgId: string;
  /** which run-of-show this is, for the report header. */
  script: string;
  claims: { say: string; claim: SpokenClaim }[];
}
