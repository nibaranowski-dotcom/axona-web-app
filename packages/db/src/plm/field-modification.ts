import type { OrgScopedDb } from "../client";
import { freezeConfigSnapshot } from "./config";
import { captureAsBuilt } from "./capture";

// PLM.V5 — recording a field modification (the most commonly missed PLM path:
// config drifts in the field and nobody records it). A swap/mod at a DEPLOYED
// unit is recorded as a FieldEvent (kind=field_modification), frozen at its own
// time. It is PENDING until a human approves it; on approval the delta is applied
// (a new UnitSoftwareState / an as-built delta) so resolveConfigAt(now) reflects
// it. The event's own frozen configSnapshot is written ONCE at record and is
// never recomputed — a prior TestRun / FieldEvent snapshot is never altered by a
// later modification (the safety-critical immutability invariant).

/// The machine-readable delta a modification applies on approval. `hw` swaps a
/// part at a BOM position (as-built delta); `sw` opens a new software-state
/// window; `calibration` records a mod with NO config delta (resolveConfigAt is
/// unchanged — a re-shim, a torque-only tweak).
export type FieldModChange =
  | {
      type: "hw";
      bomPosition: string;
      partRevisionId: string;
      partNumber: string;
      toRev: string;
      lotCode: string | null;
    }
  | {
      type: "sw";
      softwareReleaseId: string;
      component: string;
      toVersion: string;
    }
  | { type: "calibration"; detail: string };

/** Derive the human-readable "config effect" column from a change delta. */
export function effectLabel(change: FieldModChange): string {
  switch (change.type) {
    case "hw":
      return `${change.partNumber} → ${change.toRev}${
        change.lotCode ? ` · lot ${change.lotCode}` : ""
      }`;
    case "sw":
      return `${change.component} → ${change.toVersion}`;
    case "calibration":
      return `no part change · ${change.detail}`;
  }
}

export interface RecordFieldModInput {
  unitId: string;
  summary: string;
  change: FieldModChange;
  techLabel?: string | null;
  occurredAt?: Date;
}

export interface RecordFieldModResult {
  id: string;
  state: string;
  effect: string;
}

/**
 * Record a PENDING field modification. Writes the FieldEvent + its FROZEN
 * config-at-event snapshot; does NOT yet change the unit's live config (that is
 * the approval step). The frozen snapshot captures the config as it was AT the
 * event — it is inseparable from the event and never recomputed.
 */
export async function recordFieldModification(
  db: OrgScopedDb,
  input: RecordFieldModInput,
): Promise<RecordFieldModResult> {
  const unit = await db.unit.findUnique({ where: { id: input.unitId } });
  if (!unit) throw new Error(`Unit ${input.unitId} not found in this org`);

  const occurredAt = input.occurredAt ?? new Date();
  const effect = effectLabel(input.change);
  const snapshot = await freezeConfigSnapshot(db, input.unitId, occurredAt);

  const event = await db.fieldEvent.create({
    data: {
      orgId: unit.orgId,
      unitId: input.unitId,
      kind: "field_modification",
      summary: input.summary,
      occurredAt,
      configSnapshot: snapshot,
      state: "pending",
      effect,
      proposedChange: input.change as object,
      techLabel: input.techLabel ?? null,
    },
  });

  return { id: event.id, state: event.state, effect };
}

export interface ApplyFieldModResult {
  applied: boolean;
  changedConfig: boolean;
  summary: string;
}

/**
 * Apply an approved field modification's delta so resolveConfigAt(now) reflects
 * it, and flip the event to "approved" with the approver recorded. Idempotent:
 * a non-pending event is a no-op. A `calibration` change applies no config delta
 * (changedConfig=false) — it is still recorded + approved history.
 *
 * The event's OWN configSnapshot (frozen at record) is untouched here — only the
 * live config (UnitSoftwareState / AsBuiltRecord) moves forward.
 */
export async function applyFieldModification(
  db: OrgScopedDb,
  fieldEventId: string,
  approver: { id: string },
): Promise<ApplyFieldModResult> {
  const event = await db.fieldEvent.findFirst({
    where: { id: fieldEventId },
  });
  if (!event)
    throw new Error(`FieldEvent ${fieldEventId} not found in this org`);
  if (event.kind !== "field_modification") {
    throw new Error("Only a field_modification can be approved");
  }
  if (event.state !== "pending") {
    return { applied: false, changedConfig: false, summary: "already decided" };
  }

  const change = event.proposedChange as FieldModChange | null;
  let changedConfig = false;

  if (change?.type === "sw") {
    // Close the open software-state window at the event time, open a new one.
    await db.unitSoftwareState.updateMany({
      where: {
        unitId: event.unitId,
        effectiveTo: null,
        effectiveFrom: { lte: event.occurredAt },
      },
      data: { effectiveTo: event.occurredAt },
    });
    await db.unitSoftwareState.create({
      data: {
        orgId: event.orgId,
        unitId: event.unitId,
        softwareReleaseId: change.softwareReleaseId,
        effectiveFrom: event.occurredAt,
        effectiveTo: null,
      },
    });
    changedConfig = true;
  } else if (change?.type === "hw") {
    // As-built delta — the same capture path MFG uses (diff computed at write).
    await captureAsBuilt(db, {
      unitId: event.unitId,
      bomPosition: change.bomPosition,
      partRevisionId: change.partRevisionId,
      lotCode: change.lotCode,
      installedById: approver.id,
      installedAt: event.occurredAt,
      note: `Field modification · ${event.summary}`,
    });
    changedConfig = true;
  }

  await db.fieldEvent.updateMany({
    where: { id: event.id },
    data: { state: "approved", approvedById: approver.id },
  });

  return {
    applied: true,
    changedConfig,
    summary: `${event.summary} — approved${
      changedConfig ? " · unit config updated" : " · no config change"
    }`,
  };
}

/** Mark a pending field modification rejected (no config delta applied). */
export async function rejectFieldModification(
  db: OrgScopedDb,
  fieldEventId: string,
  approver: { id: string },
): Promise<{ rejected: boolean }> {
  const event = await db.fieldEvent.findFirst({ where: { id: fieldEventId } });
  if (!event || event.state !== "pending") return { rejected: false };
  await db.fieldEvent.updateMany({
    where: { id: event.id },
    data: { state: "rejected", approvedById: approver.id },
  });
  return { rejected: true };
}
