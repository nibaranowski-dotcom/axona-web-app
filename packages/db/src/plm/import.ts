import type { OrgScopedDb } from "../client";
import type { UnitStatus } from "@prisma/client";

// PLM.1a — CSV import for units + BOM. Time-to-value is a REQUIREMENT (it's why a
// prospect rejected an incumbent PLM): the registry + BOM must be usable from a
// CSV on day one. Header-mapped · dry-run · row-level errors · idempotent · no
// partial corruption (valid rows commit atomically; invalid rows never write).

export interface RowError {
  row: number; // 1-based data row (header excluded)
  message: string;
}
export interface ImportResult {
  dryRun: boolean;
  created: number;
  updated: number;
  errors: RowError[];
  totalRows: number;
}

// Minimal CSV parse — comma-delimited, optional double-quotes, CRLF tolerant.
// (Seed/import fixtures are simple; a full RFC-4180 parser is not needed here.)
function parseCsv(csv: string): { headers: string[]; rows: string[][] } {
  const lines = csv
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const split = (line: string) =>
    line.split(",").map((c) => c.trim().replace(/^"(.*)"$/, "$1"));
  const headers = split(lines[0]!).map((h) => h.toLowerCase());
  const rows = lines.slice(1).map(split);
  return { headers, rows };
}

const UNIT_STATUSES = new Set<string>([
  "in_build",
  "in_test",
  "deployed",
  "active",
  "decommissioned",
]);

/**
 * Import units by serial. Idempotent: re-import updates in place (no duplicates).
 * Required columns: serial, model (ProductModel.code), status. Optional:
 * builddate, sitelabel, customerlabel.
 */
export async function importUnits(
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

  for (const req of ["serial", "model", "status"]) {
    if (!headers.includes(req))
      return {
        dryRun,
        created: 0,
        updated: 0,
        totalRows: rows.length,
        errors: [{ row: 0, message: `missing required column "${req}"` }],
      };
  }

  // Validate every row FIRST (no partial corruption) — resolve FKs, collect errors.
  const valid: {
    rowNum: number;
    serial: string;
    productModelId: string;
    status: UnitStatus;
    buildDate: Date | null;
    siteLabel: string | null;
    customerLabel: string | null;
  }[] = [];

  // cache model-code → id
  const models = await db.productModel.findMany();
  const modelByCode = new Map(models.map((m) => [m.code, m.id]));

  rows.forEach((r, idx) => {
    const rowNum = idx + 1;
    const serial = col(r, "serial");
    const modelCode = col(r, "model");
    const status = col(r, "status");
    if (!serial) return errors.push({ row: rowNum, message: "empty serial" });
    const productModelId = modelByCode.get(modelCode);
    if (!productModelId)
      return errors.push({
        row: rowNum,
        message: `unknown product model "${modelCode}"`,
      });
    if (!UNIT_STATUSES.has(status))
      return errors.push({
        row: rowNum,
        message: `invalid status "${status}"`,
      });
    const buildRaw = col(r, "builddate");
    const buildDate = buildRaw ? new Date(buildRaw) : null;
    if (buildRaw && Number.isNaN(buildDate!.getTime()))
      return errors.push({
        row: rowNum,
        message: `invalid buildDate "${buildRaw}"`,
      });
    valid.push({
      rowNum,
      serial,
      productModelId,
      status: status as UnitStatus,
      buildDate,
      siteLabel: col(r, "sitelabel") || null,
      customerLabel: col(r, "customerlabel") || null,
    });
  });

  // Determine created vs updated (against existing serials) without writing.
  const existing = new Set(
    (
      await db.unit.findMany({
        where: { serial: { in: valid.map((v) => v.serial) } },
        select: { serial: true },
      })
    ).map((u) => u.serial),
  );
  let created = 0;
  let updated = 0;
  for (const v of valid) existing.has(v.serial) ? updated++ : created++;

  if (!dryRun && valid.length > 0) {
    // atomic — either all valid rows commit or none do
    await db.$transaction(
      valid.map((v) =>
        db.unit.upsert({
          where: { orgId_serial: { orgId: db.$org, serial: v.serial } },
          create: {
            orgId: db.$org,
            serial: v.serial,
            productModelId: v.productModelId,
            status: v.status,
            buildDate: v.buildDate,
            siteLabel: v.siteLabel,
            customerLabel: v.customerLabel,
          },
          update: {
            productModelId: v.productModelId,
            status: v.status,
            buildDate: v.buildDate,
            siteLabel: v.siteLabel,
            customerLabel: v.customerLabel,
          },
        }),
      ),
    );
  }

  return { dryRun, created, updated, errors, totalRows: rows.length };
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
