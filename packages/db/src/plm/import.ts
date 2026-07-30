import type { OrgScopedDb } from "../client";
import {
  importEntity,
  parseCsv,
  unitDescriptor,
  type ImportResult,
  type RowError,
} from "../io/import-core";

// PLM.1a — CSV import for units + BOM. Time-to-value is a REQUIREMENT (it's why a
// prospect rejected an incumbent PLM): the registry + BOM must be usable from a
// CSV on day one. Header-mapped · dry-run · row-level errors · idempotent · no
// partial corruption (valid rows commit atomically; invalid rows never write).
//
// IO.1 — the machinery above was EXTRACTED into ../io/import-core.ts (the shared
// `importEntity` core). `importUnits` is now a thin caller over `unitDescriptor`
// — its signature, contract, and byte-for-byte outputs are UNCHANGED
// (verify:plm-2 is the proof). `importBom` still carries its own (BOM-specific)
// validation but shares the one `parseCsv` — there is no second CSV parser.

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
 */
export async function importBom(
  db: OrgScopedDb,
  csv: string,
  opts: { dryRun?: boolean } = {},
): Promise<ImportResult> {
  const dryRun = opts.dryRun ?? false;
  const { headers, rows } = parseCsv(csv);
  const errors: RowError[] = [];
  const col = (r: string[], name: string) => {
    const i = headers.indexOf(name);
    return i >= 0 ? (r[i] ?? "") : "";
  };
  for (const req of [
    "model",
    "revision",
    "position",
    "partnumber",
    "rev",
    "qty",
  ]) {
    if (!headers.includes(req))
      return {
        dryRun,
        created: 0,
        updated: 0,
        totalRows: rows.length,
        errors: [{ row: 0, message: `missing required column "${req}"` }],
      };
  }

  const models = await db.productModel.findMany();
  const modelByCode = new Map(models.map((m) => [m.code, m.id]));
  const partMasters = await db.partMaster.findMany({
    include: { revisions: true },
  });
  const revByKey = new Map<string, string>(); // "partNumber|rev" → partRevisionId
  for (const pm of partMasters)
    for (const rev of pm.revisions)
      revByKey.set(`${pm.partNumber}|${rev.rev}`, rev.id);

  const valid: {
    rowNum: number;
    productModelId: string;
    designRevision: string;
    position: string;
    partRevisionId: string;
    qty: number;
  }[] = [];

  rows.forEach((r, idx) => {
    const rowNum = idx + 1;
    const productModelId = modelByCode.get(col(r, "model"));
    if (!productModelId)
      return errors.push({
        row: rowNum,
        message: `unknown product model "${col(r, "model")}"`,
      });
    const position = col(r, "position");
    if (!position)
      return errors.push({ row: rowNum, message: "empty position" });
    const partRevisionId = revByKey.get(
      `${col(r, "partnumber")}|${col(r, "rev")}`,
    );
    if (!partRevisionId)
      return errors.push({
        row: rowNum,
        message: `unknown part revision "${col(r, "partnumber")} ${col(r, "rev")}"`,
      });
    const qty = Number(col(r, "qty"));
    if (!Number.isInteger(qty) || qty <= 0)
      return errors.push({
        row: rowNum,
        message: `invalid qty "${col(r, "qty")}"`,
      });
    valid.push({
      rowNum,
      productModelId,
      designRevision: col(r, "revision"),
      position,
      partRevisionId,
      qty,
    });
  });

  // idempotent by (productModelId, designRevision, position): find existing lines
  const keyOf = (v: {
    productModelId: string;
    designRevision: string;
    position: string;
  }) => `${v.productModelId}|${v.designRevision}|${v.position}`;
  const existingLines = await db.bomLine.findMany({
    where: { productModelId: { in: valid.map((v) => v.productModelId) } },
  });
  const existingByKey = new Map(
    existingLines.map((l) => [
      `${l.productModelId}|${l.designRevision}|${l.position}`,
      l.id,
    ]),
  );
  let created = 0;
  let updated = 0;

  const ops = valid.map((v) => {
    const existingId = existingByKey.get(keyOf(v));
    if (existingId) {
      updated++;
      return db.bomLine.update({
        where: { id: existingId },
        data: { partRevisionId: v.partRevisionId, qty: v.qty },
      });
    }
    created++;
    return db.bomLine.create({
      data: {
        orgId: db.$org,
        productModelId: v.productModelId,
        designRevision: v.designRevision,
        position: v.position,
        partRevisionId: v.partRevisionId,
        qty: v.qty,
      },
    });
  });

  if (!dryRun && ops.length > 0) await db.$transaction(ops);

  return { dryRun, created, updated, errors, totalRows: rows.length };
}
