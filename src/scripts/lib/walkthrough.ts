/**
 * DEMOVERIFY — the walkthrough manifest contract.
 *
 * A manifest turns a prospect email's SENTENCES into data assertions: the exact
 * deep-links the email contains, the hero entity each link is about, and the
 * specific factual claims the copy makes. `pnpm verify:demo <prospect>` then checks
 * every one of them against that tenant's seeded data and answers SAFE TO SEND /
 * NOT SAFE.
 *
 * This file is COMMITTED and therefore MARQUE-FREE: it defines only the shape.
 * Every tenant name, org id, hero code and claimed value lives in the manifest
 * itself, which sits beside the prospect config under the gitignored `prospects/`
 * tree (SEED.1 — a real marque must never reach the repo).
 *
 * Authoring a manifest is the point, not a chore: you cannot write one without
 * turning each sentence into something checkable, which is where the two real
 * errors in the first email set came from — a claim about a part's location count
 * and a claim about spare availability, both contradicted by the seeded data.
 */

/** What kind of entity a step's `heroCode` names — drives the populated-ness check. */
export type HeroKind =
  | "unit"
  | "po"
  | "ncr"
  | "part"
  | "testRun"
  | "eco"
  | "workOrder"
  | "screen";

/**
 * A checkable predicate. Deliberately DECLARATIVE (a descriptor, not a function):
 * manifests stay data, the checking logic stays here in committed code, and every
 * claim can report the ACTUAL value it found when it fails.
 */
export type Claim =
  /** e.g. "sent, six days past the promised date" */
  | { kind: "po.status"; code: string; equals: string }
  | { kind: "po.daysPastPromised"; code: string; atLeast: number }
  /** e.g. "our agent drafted this one" */
  | { kind: "po.agentDrafted"; code: string; is: boolean }
  /** e.g. "below its minimum" */
  | { kind: "part.onHandBelowMin"; sku: string; is: boolean }
  /** e.g. "the same part sitting in five locations" — the count is asserted, not eyeballed */
  | { kind: "part.locationCount"; sku: string; equals: number }
  /** e.g. "no local spare" — asserts stock AT a named location */
  | {
      kind: "part.onHandAtLocation";
      sku: string;
      location: string;
      equals: number;
    }
  /** e.g. "deployed at Customer-A" */
  | { kind: "unit.customerLabel"; serial: string; equals: string }
  /** e.g. "~85% in-house, two parts blocking" */
  | {
      kind: "unit.buildReadiness";
      serial: string;
      pctInHouse?: { approx: number; tolerance: number };
      blocking?: number;
    }
  /** e.g. "here is the failure" */
  | { kind: "testRun.outcome"; code: string; equals: string }
  /**
   * e.g. "stock spans Warsaw, line-side, Switzerland, consignment and on-site".
   * Asserts the tenant's inventory location SET contains each named location — the
   * corrected form of a claim that was previously (and wrongly) read as "one part
   * sitting in five locations".
   */
  | { kind: "inventory.locationsInclude"; locations: string[] }
  /** e.g. "dual sign-off is logged against the change" */
  | { kind: "eco.stage"; code: string; equals: string }
  /** e.g. "traced to a root cause" */
  | { kind: "ncr.hasRootCause"; code: string; is: boolean };

export interface WalkthroughStep {
  /** The exact app route the email links to, e.g. `/units/SN-0001` or `/procurement`. */
  route: string;
  /** The entity the step is about. Omit for a screen-level link with no hero. */
  heroCode?: string;
  kind: HeroKind;
  /** What the email asserts about it. Every one must hold. */
  claims?: Claim[];
  /** Optional note echoed in output — the sentence this step came from. */
  note?: string;
}

export interface WalkthroughManifest {
  /** The tenant these steps belong to — must match the prospect config's orgId. */
  orgId: string;
  /** Which email/sequence this manifest covers (free text, shown in output). */
  email: string;
  steps: WalkthroughStep[];
}

/** A single check's verdict, carrying the ACTUAL value so failures are actionable. */
export interface CheckResult {
  ok: boolean;
  label: string;
  detail?: string;
}
