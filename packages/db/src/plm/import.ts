import type { OrgScopedDb } from "../client";
import {
  importEntity,
  bomLineDescriptor,
  unitDescriptor,
  type ImportResult,
  type ImportSource,
  type RowError,
} from "../io/import-core";

// PLM.1a — CSV import for units + BOM. Time-to-value is a REQUIREMENT (it's why a
// prospect rejected an incumbent PLM): the registry + BOM must be usable from a
// CSV on day one. Header-mapped · dry-run · row-level errors · idempotent · no
// partial corruption (valid rows commit atomically; invalid rows never write).
//
// IO.1 — the machinery above was EXTRACTED into ../io/import-core.ts (the shared
// `importEntity` core). `importUnits` is a thin caller over `unitDescriptor`; its
// signature, contract, and byte-for-byte outputs are UNCHANGED (verify:plm-2 is the
// proof). MFX.1 — `importBom` is now ALSO a thin caller (over `bomLineDescriptor`):
// its own BOM-specific validation moved into the descriptor verbatim, so there is
// no second BOM code path, and CSV or xlsx (an `.xlsx` Excel BOM, priority-1) flows
// through the same core.

export type { ImportResult, RowError };

/**
 * Import units by serial. Idempotent: re-import updates in place (no duplicates).
 * Required columns: serial, model (ProductModel.code), status. Optional:
 * builddate, sitelabel, customerlabel. (Thin caller over the IO.1 core.)
 */
export async function importUnits(
  db: OrgScopedDb,
  csv: string,
  opts: { dryRun?: boolean } = {},
): Promise<ImportResult> {
  return importEntity(db, unitDescriptor, { text: csv }, opts);
}

/**
 * Import as-designed BOM lines. Idempotent by (product model, design revision,
 * position). Required columns: model, revision, position, partnumber, rev, qty.
 * A thin caller over the IO.1 `bomLineDescriptor` — accepts a CSV string OR a full
 * `ImportSource` (so an `.xlsx` Excel BOM imports via `{ bytes }`).
 */
export async function importBom(
  db: OrgScopedDb,
  source: string | ImportSource,
  opts: { dryRun?: boolean } = {},
): Promise<ImportResult> {
  const src: ImportSource =
    typeof source === "string" ? { text: source } : source;
  return importEntity(db, bomLineDescriptor, src, opts);
}
