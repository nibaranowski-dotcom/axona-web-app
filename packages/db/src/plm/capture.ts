import type { OrgScopedDb } from "../client";

// PLM.V3 — the as-built CAPTURE step (L1 capture fidelity). At build a component
// is scanned against the BOM: its lot + revision are recorded and the diff vs the
// as-designed position is computed AT WRITE TIME (never reconstructed later). The
// substitution flag is a stored fact about what was captured, not a derivation —
// that is the whole moat invariant ("as-built is captured, never reconstructed").

export interface CaptureInput {
  unitId: string;
  bomPosition: string;
  /** The revision actually installed (may differ from the as-designed part). */
  partRevisionId: string;
  lotCode?: string | null;
  componentSerial?: string | null;
  installedById?: string | null;
  installedAt?: Date;
  note?: string | null;
}

export interface CaptureResult {
  id: string;
  unitId: string;
  bomPosition: string;
  /** Computed at write time by aligning the scanned part to the BOM position. */
  isSubstitution: boolean;
  /** The as-designed part at this position, if the BOM defines one. */
  expectedPartRevisionId: string | null;
}

/**
 * Capture one as-built component against a unit's BOM position. Idempotent per
 * (unit, position): re-scanning the same position updates that record rather than
 * appending a duplicate — a station re-scan is normal, not a new physical part.
 * The substitution flag is computed HERE, from the as-designed BOM, and stored.
 */
export async function captureAsBuilt(
  db: OrgScopedDb,
  input: CaptureInput,
): Promise<CaptureResult> {
  const unit = await db.unit.findUnique({ where: { id: input.unitId } });
  if (!unit) throw new Error(`Unit ${input.unitId} not found in this org`);

  // The as-designed part at this position (the diff basis, resolved at write time).
  const designed = await db.bomLine.findFirst({
    where: { productModelId: unit.productModelId, position: input.bomPosition },
    select: { partRevisionId: true },
  });
  const expectedPartRevisionId = designed?.partRevisionId ?? null;
  const isSubstitution =
    expectedPartRevisionId !== null &&
    expectedPartRevisionId !== input.partRevisionId;

  const data = {
    orgId: unit.orgId,
    unitId: input.unitId,
    bomPosition: input.bomPosition,
    partRevisionId: input.partRevisionId,
    lotCode: input.lotCode ?? null,
    componentSerial: input.componentSerial ?? null,
    installedById: input.installedById ?? null,
    installedAt: input.installedAt ?? new Date(),
    isSubstitution,
    note: input.note ?? null,
  };

  const existing = await db.asBuiltRecord.findFirst({
    where: { unitId: input.unitId, bomPosition: input.bomPosition },
    select: { id: true },
  });
  const record = existing
    ? await db.asBuiltRecord.update({ where: { id: existing.id }, data })
    : await db.asBuiltRecord.create({ data });

  return {
    id: record.id,
    unitId: record.unitId,
    bomPosition: record.bomPosition,
    isSubstitution,
    expectedPartRevisionId,
  };
}
