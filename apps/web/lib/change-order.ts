import { dbForOrg } from "@axona/db";
import { affectedUnits } from "@axona/agents";

// PLM.9 — the Change Order read model (`Change Order.dc.html`). Answers Q5: an
// ECO's rationale + affected part revisions + reviewers/approval state +
// EFFECTIVITY (from serial/date) + AFFECTED UNITS (computed via ONT.1
// affectedUnits, respecting effectivity) + per-unit ROLLOUT (from the as-built:
// a unit still carrying the superseded part is pending; one that doesn't is done).
// Org-scoped. Approval routes through decide("eco.release") (RBAC.5).

export type RolloutState = "pending" | "applied" | "not_applicable";

export interface AffectedUnitRow {
  serial: string;
  site: string | null;
  /** In the effectivity window (serial ≥ effectiveFromSerial) → the change applies. */
  inEffectivity: boolean;
  rollout: RolloutState;
  href: string;
}

export interface ChangeOrderData {
  code: string;
  title: string;
  changeType: string;
  stage: string; // DRAFT | REVIEW | RELEASED
  isPending: boolean; // can still be decided (not RELEASED)
  rationale: string | null;
  changeRequestCode: string | null;
  supersede: { from: string; to: string } | null;
  effectiveFromSerial: string | null;
  effectiveFromDate: string | null;
  rolloutStatus: string;
  affected: AffectedUnitRow[];
  applied: number;
  pending: number;
  registryHref: string;
}

/** Serials compare lexically within the SN-#### convention (numeric suffix). */
function serialGte(a: string, from: string): boolean {
  const na = Number.parseInt(a.replace(/\D/g, ""), 10);
  const nf = Number.parseInt(from.replace(/\D/g, ""), 10);
  if (Number.isFinite(na) && Number.isFinite(nf)) return na >= nf;
  return a >= from;
}

export async function getChangeOrder(
  orgId: string,
  code: string,
): Promise<ChangeOrderData | null> {
  const db = dbForOrg(orgId);
  const eco = await db.eCO.findFirst({ where: { code } });
  if (!eco) return null;

  // the originating ECR (ChangeRequest) — scalar link both ways.
  const cr =
    (await db.changeRequest.findFirst({ where: { ecoId: eco.id } })) ??
    (eco.changeRequestId
      ? await db.changeRequest.findFirst({
          where: { code: eco.changeRequestId },
        })
      : null);

  // supersede pair parsed from the title ("Supersede SERVO-204 → -205" or the
  // fully-qualified form). The target may be a bare "-205" suffix → prefix it with
  // the source part family so the rollout check has the real part number.
  const m = eco.title.match(
    /([A-Z]+)-(\d+)\s*(?:→|->|to)\s*(?:([A-Z]+)-|-)?(\d+)/i,
  );
  const supersede = m
    ? { from: `${m[1]}-${m[2]}`, to: `${m[3] ?? m[1]}-${m[4]}` }
    : null;

  // AFFECTED UNITS — computed via ONT.1 (never hardcoded), then scoped by effectivity.
  const affected = await affectedUnits(db, { ecoId: code });
  const supersededPart = supersede?.from ?? null;

  // per-unit rollout: does the as-built still carry the superseded part revision?
  const unitIds = affected.units.map((u) => u.id);
  const asBuilt = unitIds.length
    ? await db.asBuiltRecord.findMany({
        where: { unitId: { in: unitIds } },
        include: { partRevision: { include: { partMaster: true } } },
      })
    : [];
  const carriesSuperseded = new Set(
    supersededPart
      ? asBuilt
          .filter(
            (r) => r.partRevision.partMaster.partNumber === supersededPart,
          )
          .map((r) => r.unitId)
      : [],
  );

  const rows: AffectedUnitRow[] = affected.units
    .map((u) => {
      const inEff = eco.effectiveFromSerial
        ? serialGte(u.serial, eco.effectiveFromSerial)
        : true;
      // grandfathered units (before effectivity) are not required to change;
      // in-effectivity units that still carry the old part are pending.
      const rollout: RolloutState = !inEff
        ? "not_applicable"
        : carriesSuperseded.has(u.id)
          ? "pending"
          : "applied";
      return {
        serial: u.serial,
        site: u.siteLabel ?? null,
        inEffectivity: inEff,
        rollout,
        href: `/units/${encodeURIComponent(u.serial)}`,
      };
    })
    .sort((a, b) => a.serial.localeCompare(b.serial));

  return {
    code: eco.code,
    title: eco.title,
    changeType: eco.changeType,
    stage: eco.stage,
    isPending: eco.stage !== "RELEASED",
    rationale: cr?.rationale ?? null,
    changeRequestCode: cr?.code ?? eco.changeRequestId ?? null,
    supersede,
    effectiveFromSerial: eco.effectiveFromSerial,
    effectiveFromDate: eco.effectiveFromDate
      ? new Date(eco.effectiveFromDate).toISOString().slice(0, 10)
      : null,
    rolloutStatus: eco.rolloutStatus,
    affected: rows,
    applied: rows.filter((r) => r.rollout === "applied").length,
    pending: rows.filter((r) => r.rollout === "pending").length,
    registryHref: "/units",
  };
}
