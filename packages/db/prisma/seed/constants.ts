// Stable ids + narrative codes + a relative-date helper for the seed (FND.12).
// Stable org ids make clear-then-seed idempotent (re-seed targets the same tenant).

export const DEMO_ORG_ID = "org_axona_demo";
export const SECOND_ORG_ID = "org_isolation_test";

/** Narrative codes (build-spec §3.7) — the cross-module chain hangs off these. */
export const CODES = {
  ncr: "NCR-118",
  lot: "lot 88421",
  eco: "ECO-318",
  servoOld: "SERVO-204",
  servoNew: "SERVO-205",
  firmware: "v4.2.2-rc",
  delivery: "DLV-3312",
  robot: "SN-2196",
  policy: "p-13",
  product: "HX-2",
  incident: "INC-201",
} as const;

/**
 * Relative date helper so SLA countdowns / AR aging always look live.
 * Supports "+6h" / "-9d" / "+3w" / "+2m". (Runs in plain Node via tsx — `new
 * Date()` is fine here; the workflow-script restriction does not apply.)
 */
export function d(offset: string): Date {
  const now = new Date();
  const m = /^([+-])(\d+)([hdwm])$/.exec(offset.trim());
  if (!m) throw new Error(`bad date offset: ${offset}`);
  const sign = m[1] === "-" ? -1 : 1;
  const n = sign * Number.parseInt(m[2] ?? "0", 10);
  const unit = m[3];
  const ms =
    unit === "h"
      ? 3_600_000
      : unit === "d"
        ? 86_400_000
        : unit === "w"
          ? 7 * 86_400_000
          : 30 * 86_400_000;
  return new Date(now.getTime() + n * ms);
}
